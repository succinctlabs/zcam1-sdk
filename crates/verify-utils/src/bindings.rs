use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};
use zcam1_c2pa_utils::types::DeviceBindings;
use zcam1_ios::{validate_assertion, validate_attestation};

use crate::error::VerifyError;

/// Verify Apple App Attest bindings from a C2PA manifest.
#[cfg(feature = "apple-verify")]
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

    let public_key_uncompressed = zcam1_ios::validate_attestation(
        &bindings.attestation,
        &bindings.device_key_id,
        &bindings.device_key_id,
        &bindings.app_id,
        production,
        !production,
    )?;

    let is_valid = zcam1_ios::validate_assertion(
        &bindings.assertion,
        client_data.as_bytes(),
        &public_key_uncompressed,
        &bindings.app_id,
        0,
    )?;

    Ok(is_valid)
}

/// Verify Android Key Attestation bindings from a C2PA manifest.
#[cfg(feature = "android-verify")]
#[uniffi::export]
pub fn verify_android_bindings_from_manifest(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: Vec<u8>,
    expected_package_name: &str,
    production: bool,
) -> Result<bool, VerifyError> {
    // Handle emulator mock attestation (no real hardware key on emulator)
    if bindings.attestation.starts_with("SIMULATOR_MOCK_") {
        return Ok(true);
    }

    // 1. Validate Key Attestation chain — verifies cert chain roots to Google CA,
    //    checks challenge, security levels, package name
    let key_result = zcam1_android::validate_key_attestation(
        &bindings.attestation,
        &bindings.device_key_id,
        expected_package_name,
        production,
    )?;

    // 2. Reconstruct the signed message: base64(photoHash)|base64(sha256(metadata))
    let metadata_hash = Sha256::digest(normalized_metadata.as_bytes());
    let client_data = format!(
        "{}|{}",
        Base64::encode_string(&photo_hash),
        Base64::encode_string(&metadata_hash)
    );

    // 3. Verify the ECDSA signature against the public key from the attestation chain
    zcam1_android::verify_signature(
        &bindings.assertion,
        &client_data,
        &key_result.public_key_hex,
    )?;

    Ok(true)
}
