#![no_main]
sp1_zkvm::entrypoint!(main);

use std::io::Cursor;

use base64ct::{Base64, Encoding};
use zcam1_c2pa_utils::{compute_hash_from_stream, extract_manifest_from_stream};
use zcam1_ios::{validate_assertion, validate_attestation, AuthInputs, APPLE_ROOT_CERT};

pub fn main() {
    let auth_inputs = sp1_zkvm::io::read::<AuthInputs>();
    let mut photo_stream = Cursor::new(&auth_inputs.photo_bytes);
    let store = extract_manifest_from_stream(&auth_inputs.format, photo_stream.clone()).unwrap();
    let active_manifest = store.active_manifest().unwrap();
    let bindings = active_manifest.bindings().unwrap();
    let data_hash = active_manifest.data_hash();
    let photo_hash = compute_hash_from_stream(&mut photo_stream, &data_hash.exclusions).unwrap();
    let client_data = Base64::encode_string(&photo_hash);

    assert_eq!(data_hash.hash, client_data);

    // Skip App Attest validation if we are on a simulator
    if !bindings.attestation.starts_with("SIMULATOR_MOCK_") {
        let public_key_uncompressed = validate_attestation(
            &bindings.attestation,
            &bindings.device_key_id,
            &bindings.device_key_id,
            &bindings.app_id,
            auth_inputs.app_attest_production,
            !auth_inputs.app_attest_production, // Skip full chain validation for development
        )
        .unwrap();

        validate_assertion(
            &bindings.assertion,
            client_data.as_bytes(),
            &public_key_uncompressed,
            &bindings.app_id,
            0,
        )
        .unwrap();
    }

    sp1_zkvm::io::commit_slice(&photo_hash);
    sp1_zkvm::io::commit_slice(APPLE_ROOT_CERT.as_bytes());
}
