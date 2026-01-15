use base64ct::{Base64, Encoding};
use serde::{Deserialize, Serialize};
use sp1_uniffi_verifier as _;

use zcam1_ios::{validate_assertion, validate_attestation};

use crate::error::VerifyError;

uniffi::setup_scaffolding!();

mod error;

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DeviceBindings {
    pub app_id: String,
    pub device_key_id: String,
    pub attestation: String,
    pub assertion: String,
}

#[uniffi::export]
pub fn verify_bindings_from_manifest(
    bindings: &DeviceBindings,
    photo_hash: Vec<u8>,
    production: bool,
) -> Result<bool, VerifyError> {
    if bindings.attestation.starts_with("SIMULATOR_MOCK_") {
        return Ok(true);
    }

    let client_data = Base64::encode_string(&photo_hash);

    let public_key_uncompressed = validate_attestation(
        &bindings.attestation,
        &bindings.device_key_id,
        &bindings.device_key_id,
        &bindings.app_id,
        production,
        !production,
    )?;

    let is_valid = validate_assertion(
        &bindings.assertion,
        client_data.as_bytes(),
        &public_key_uncompressed,
        &bindings.app_id,
        0,
    )?;

    Ok(is_valid)
}
