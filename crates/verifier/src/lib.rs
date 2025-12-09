use zcam1_c2pa_utils::types::DataHash;

use crate::error::Error;

pub mod error;
pub mod ios;

/// Verifies that a file's hash matches the hash from a C2PA manifest.
///
/// # Arguments
///
/// * `path` - Path to the file whose hash will be computed from its bytes
/// * `data_hash` - The hash value from a C2PA manifest to verify against
///
/// # Returns
///
/// Returns `Ok(true)` if the computed hash matches the manifest hash, `Ok(false)` otherwise.
pub fn verify_hash(path: &str, data_hash: &DataHash) -> Result<bool, Error> {
    let is_valid = zcam1_c2pa_utils::verify_hash(path, data_hash)?;

    Ok(is_valid)
}
