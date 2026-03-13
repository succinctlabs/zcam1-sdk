use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};
use zcam1_android::validate_attestation;
use zcam1_c2pa_utils::{compute_hash, extract_manifest};

const WITH_BINDINGS: &str = "./tests/fixtures/with_bindings.jpg";

#[test]
fn test_validate() {
    let manifest_store = extract_manifest(WITH_BINDINGS).unwrap();
    let active_manifest = manifest_store.active_manifest().unwrap();
    let bindings = active_manifest.bindings().unwrap();
    let photo_hash = compute_hash(WITH_BINDINGS).unwrap();
    let capture_metadata = active_manifest.capture_metadata_action().unwrap().unwrap();
    let metadata_hash = Sha256::digest(capture_metadata.into_bytes());
    let client_data = format!(
        "{}|{}",
        Base64::encode_string(&photo_hash),
        Base64::encode_string(&metadata_hash)
    );
    validate_attestation(
        &bindings.attestation,
        &bindings.assertion,
        &client_data,
        &bindings.device_key_id,
        &bindings.app_id,
    )
    .unwrap();
}
