use base64ct::{Base64UrlUnpadded, Encoding};
use c2pa::{CallbackSigner, SigningAlg};
use p256::ecdsa::{signature::Signer, Signature, SigningKey};
use serde_json::json;
use tempfile::tempdir;
use zcam1_c2pa_utils::{compute_hash, ManifestEditor};
use zcam1_common::generate_cert_chain;

#[tokio::test]
async fn test_video_hash() {
    // Generate a fresh P-256 keypair and construct a JWK from the public key coordinates.
    let signing_key = SigningKey::from_slice(&[1u8; 32]).unwrap();
    let verifying_key = signing_key.verifying_key();

    let encoded_point = verifying_key.to_encoded_point(false);
    let x = encoded_point.x().unwrap();
    let y = encoded_point.y().unwrap();

    let jwk = json!({
        "kty": "EC",
        "crv": "P-256",
        "x": Base64UrlUnpadded::encode_string(x),
        "y": Base64UrlUnpadded::encode_string(y),
    });

    let certs = generate_cert_chain(jwk, "TEST SUBJECT", "TEST ORG").unwrap();

    let signer = CallbackSigner::new(
        move |_context, data: &[u8]| -> Result<Vec<u8>, c2pa::Error> {
            let signature: Signature = signing_key.sign(data);
            Ok(signature.to_der().as_bytes().to_vec())
        },
        SigningAlg::Es256,
        certs.as_str(),
    );

    let editor = ManifestEditor::with_signer("./tests/fixtures/video1_no_manifest.mp4", signer);
    let destination_file = tempdir().unwrap();
    let destination_path = destination_file.path();
    let destination_path = destination_path.join("output.mp4");
    let destination_path = destination_path.to_str().unwrap();

    let orig_hash = compute_hash("./tests/fixtures/video1_no_manifest.mp4").unwrap();

    editor
        .add_action(
            &json!({
              "action": "succinct.capture",
              "when": "Bla",
              "parameters": {},
            })
            .to_string(),
        )
        .unwrap();

    // Add an assertion containing all data needed to later generate a  proof
    editor
        .add_assertion(
            "succinct.bindings",
            &json!({
              "app_id": "BlaBla",
              "device_key_id": "Bla",
              "attestation": "BlaBlaBlaB",
              "assertion": "BlaBla",
            })
            .to_string(),
        )
        .unwrap();

    editor
        .embed_manifest_to_file(destination_path, "mp4")
        .await
        .unwrap();

    let with_manifest_hash = compute_hash(destination_path).unwrap();

    assert_eq!(orig_hash, with_manifest_hash)
}
