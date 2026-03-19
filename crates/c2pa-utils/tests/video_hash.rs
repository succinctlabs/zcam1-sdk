use base64ct::{Base64UrlUnpadded, Encoding};
use c2pa::{CallbackSigner, SigningAlg};
use p256::ecdsa::{signature::Signer, Signature, SigningKey};
use serde_json::json;
use tempfile::tempdir;
use zcam1_c2pa_utils::{compute_hash, extract_manifest, ManifestEditor};
use zcam1_certs_utils::{build_self_signed_certificate, JwkEcKey};

#[tokio::test]
async fn test_video_hash() {
    let signing_key = SigningKey::from_slice(&[1u8; 32]).unwrap();
    let verifying_key = signing_key.verifying_key();
    let encoded_point = verifying_key.to_encoded_point(false);

    let jwk = JwkEcKey {
        kty: "EC".into(),
        crv: "P-256".into(),
        x: Base64UrlUnpadded::encode_string(encoded_point.x().unwrap()),
        y: Base64UrlUnpadded::encode_string(encoded_point.y().unwrap()),
    };

    let certs = build_self_signed_certificate(&jwk, None).unwrap();

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
    assert_eq!(orig_hash, with_manifest_hash, "Hash should be unchanged after manifest embedding");

    // Verify the bindings assertion survived the round-trip
    let store = extract_manifest(destination_path).unwrap();
    let active = store.active_manifest().unwrap();
    let bindings = active.bindings().expect("Bindings should be present after embedding");
    assert_eq!(bindings.app_id, "BlaBla");
    assert_eq!(bindings.device_key_id, "Bla");
    assert_eq!(bindings.attestation, "BlaBlaBlaB");
    assert_eq!(bindings.assertion, "BlaBla");
}
