use base64ct::{Base64, Encoding};
use zcam1_c2pa_utils::{compute_hash, extract_manifest};
use zcam1_ios::{validate_assertion, validate_attestation};

const WITH_BINDINGS: &str = "./tests/fixtures/with_bindings.jpg";

#[test]
fn test_validate() {
    let manifest_store = extract_manifest(WITH_BINDINGS).unwrap();
    let active_manifest = manifest_store.active_manifest().unwrap();
    let hash = compute_hash(WITH_BINDINGS).unwrap();
    let client_data = Base64::encode_string(&hash);
    let bindings = active_manifest.bindings().unwrap();

    let public_key = validate_attestation(
        &bindings.attestation,
        &bindings.device_key_id,
        &bindings.device_key_id,
        &bindings.app_id,
        false,
        false,
    )
    .unwrap();

    let is_valid = validate_assertion(
        &bindings.assertion,
        client_data.as_bytes(),
        &public_key,
        &bindings.app_id,
        0,
    )
    .unwrap();

    assert!(is_valid);
}
