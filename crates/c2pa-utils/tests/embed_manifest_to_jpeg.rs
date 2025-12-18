use base64ct::{Base64UrlUnpadded, Encoding};
use c2pa::{CallbackSigner, SigningAlg};
use p256::{
    ecdsa::{signature::Signer, Signature, SigningKey},
    elliptic_curve::rand_core::OsRng,
};
use serde_json::json;
use tempfile::tempdir;
use zcam1_c2pa_utils::{extract_manifest, ManifestEditor};
use zcam1_common::generate_cert_chain;

#[tokio::test]
async fn test_embed_manifest_to_jpg() {
    // Generate a fresh P-256 keypair and construct a JWK from the public key coordinates.
    let signing_key = SigningKey::random(&mut OsRng);
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

    let editor = ManifestEditor::with_signer("./tests/fixtures/sample.jpg", signer);
    let destination_file = tempdir().unwrap();
    let destination_path = destination_file.path();
    let destination_path = destination_path.join("output.jpg");

    editor
        .embed_manifest_to_file(destination_path.to_str().unwrap(), "jpg")
        .await
        .unwrap();

    let store = extract_manifest(destination_path.to_str().unwrap()).unwrap();

    println!("{store:#?}")
}
