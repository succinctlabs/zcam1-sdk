use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};
use zcam1_c2pa_utils::types::DeviceBindings;
use zcam1_ios::{validate_assertion, validate_attestation};

use crate::error::VerifyError;

#[uniffi::export]
pub fn verify_bindings_from_manifest(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<bool, VerifyError> {
    if bindings.attestation.starts_with("SIMULATOR_MOCK_") {
        return Ok(true);
    }

    let metadata_hash = Sha256::digest(normalized_metadata.as_bytes());
    let client_data = format!(
        "{}|{}",
        Base64::encode_string(photo_hash),
        Base64::encode_string(&metadata_hash)
    );

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
