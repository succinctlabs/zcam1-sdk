use std::fs::File;

use base64ct::{Base64, Encoding};
use zcam1_c2pa_utils::types::AssetHash;

use crate::error::Error;

pub mod error;
pub mod ios;

/// Verifies that a file's hash matches the hash from a C2PA manifest.
///
/// # Arguments
///
/// * `path` - Path to the file whose hash will be computed from its bytes
/// * `hash` - The hash value from a C2PA manifest to verify against
///
/// # Returns
///
/// Returns `Ok(true)` if the computed hash matches the manifest hash, `Ok(false)` otherwise.
pub fn verify_hash(path: &str, hash: &AssetHash) -> Result<bool, Error> {
    let mut file = File::open(path.replace("file://", ""))?;
    let real_hash = hash.compute_hash_from_stream(&mut file)?;
    let real_hash = Base64::encode_string(&real_hash);
    let is_valid = hash.value().map(|h| h == real_hash).unwrap_or_default();

    Ok(is_valid)
}
