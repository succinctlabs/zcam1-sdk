#![no_main]
sp1_zkvm::entrypoint!(main);

use base64ct::{Base64, Encoding};
use zcam1_ios::{APPLE_ROOT_CERT, AuthInputs, validate_assertion, validate_attestation};

pub fn main() {
    let auth_inputs = sp1_zkvm::io::read::<AuthInputs>();
    let client_data = Base64::encode_string(&auth_inputs.data_hash);

    let public_key_uncompressed = validate_attestation(
        &auth_inputs.attestation,
        &auth_inputs.key_id,
        &auth_inputs.challenge,
        &auth_inputs.app_id,
        auth_inputs.app_attest_production,
        !auth_inputs.app_attest_production, // Skip full chain validation for development
    )
    .unwrap();

    validate_assertion(
        &auth_inputs.assertion,
        client_data.as_bytes(),
        &public_key_uncompressed,
        &auth_inputs.app_id,
        0,
    )
    .unwrap();

    sp1_zkvm::io::commit_slice(&auth_inputs.data_hash);
    sp1_zkvm::io::commit_slice(APPLE_ROOT_CERT.as_bytes());
}
