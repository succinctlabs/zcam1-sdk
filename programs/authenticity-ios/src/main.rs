#![no_main]
sp1_zkvm::entrypoint!(main);

use std::io::Cursor;

use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};
use zcam1_c2pa_utils::{compute_hash_from_stream, extract_manifest_from_stream};
use zcam1_ios::{APPLE_ROOT_CERT, AuthInputs, validate_assertion, validate_attestation};

pub fn main() {
    let auth_inputs = sp1_zkvm::io::read::<AuthInputs>();
    let mut photo_stream = Cursor::new(&auth_inputs.photo_bytes);
    let store = extract_manifest_from_stream(&auth_inputs.format, &mut photo_stream).unwrap();
    let active_manifest = store.active_manifest().unwrap();
    let bindings = active_manifest.bindings().unwrap();
    let capture_metadata = active_manifest.capture_metadata_action().unwrap().unwrap();
    let metadata_hash = Sha256::digest(capture_metadata.into_bytes());
    let photo_hash = compute_hash_from_stream(
        &mut photo_stream,
        auth_inputs.photo_bytes.len(),
        &auth_inputs.format,
    )
    .unwrap();
    let client_data = format!(
        "{}|{}",
        Base64::encode_string(&photo_hash),
        Base64::encode_string(&metadata_hash)
    );

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
