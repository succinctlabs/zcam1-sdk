use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};
use zcam1_c2pa_utils::{compute_hash, extract_manifest, types::DeviceBindings};
use zcam1_ios::{validate_assertion, validate_attestation};

use crate::error::VerifyError;

/// Extracts the manifest from a file at `path`, then verifies the device bindings
/// contained within it. Set `production` to `true` to reject simulator attestations.
pub fn verify_bindings_from_file(path: &str, production: bool) -> Result<bool, VerifyError> {
    let manifest_store = extract_manifest(path)?;
    let active_manifest = manifest_store.active_manifest()?;
    let bindings = active_manifest
        .bindings()
        .ok_or_else(|| VerifyError::BindingsNotFound)?;
    let photo_hash = compute_hash(path)?;
    let capture_metadata = active_manifest
        .capture_metadata_action()?
        .ok_or_else(|| VerifyError::MetadataNotFound)?;

    verify_bindings_from_manifest(&bindings, &capture_metadata, &photo_hash, production)
}

/// Verifies device bindings against a photo hash and its normalized capture metadata.
///
/// Hashes `normalized_metadata` and `photo_hash` together as client data, then
/// validates the Apple attestation certificate and the assertion signature.
/// Returns `Err(SimulatorNotAllowed)` if a simulator mock attestation is presented
/// with `production` set to `true`.
#[uniffi::export]
pub fn verify_bindings_from_manifest(
    bindings: &DeviceBindings,
    normalized_metadata: &str,
    photo_hash: &[u8],
    production: bool,
) -> Result<bool, VerifyError> {
    if bindings.attestation.starts_with("SIMULATOR_MOCK_") {
        if production {
            return Err(VerifyError::SimulatorNotAllowed);
        }
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
