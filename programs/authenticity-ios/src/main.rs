#![no_main]
sp1_zkvm::entrypoint!(main);

use zcam1_ios::{APPLE_ROOT_CERT, AuthInputs, validate_assertion, validate_attestation};

pub fn main() {
    let auth_inputs = sp1_zkvm::io::read::<AuthInputs>();

    let public_key_uncompressed = validate_attestation(
        &auth_inputs.attestation,
        &auth_inputs.key_id,
        &auth_inputs.challenge,
        &auth_inputs.app_id,
        auth_inputs.app_attest_production,
        false,
    )
    .unwrap();

    validate_assertion(
        &auth_inputs.assertion,
        &auth_inputs.data_hash,
        &public_key_uncompressed,
        &auth_inputs.app_id,
        0,
    )
    .unwrap();

    sp1_zkvm::io::commit(&auth_inputs.data_hash);
    sp1_zkvm::io::commit(&APPLE_ROOT_CERT);
}
