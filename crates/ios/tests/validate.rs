use zcam1_c2pa_utils::extract_manifest;
use zcam1_ios::{validate_assertion, validate_attestation};

#[test]
fn test_validate() {
    let manifest_store = extract_manifest("./tests/fixtures/with_bindings.jpg").unwrap();
    let active_manifest = manifest_store.active_manifest().unwrap();
    let data_hash = active_manifest.data_hash();
    let bindings = active_manifest.bindings().unwrap();
    let client_data = data_hash.hash.as_bytes();

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
        client_data,
        &public_key,
        &bindings.app_id,
        0,
    )
    .unwrap();

    assert!(is_valid);
}
