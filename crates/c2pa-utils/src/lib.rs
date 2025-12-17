use std::fs::File;

use base64ct::{Base64, Encoding};
use c2pa::{hash_stream_by_alg, Reader};

use crate::{
    error::Error,
    types::{DataHash, Exclusion, ManifestStore},
};

pub mod error;
mod manifest_editor;
mod signing;
pub mod types;

uniffi::setup_scaffolding!();

pub use manifest_editor::ManifestEditor;

#[uniffi::export]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, Error> {
    let reader = Reader::from_file(path.replace("file://", ""))?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}

#[uniffi::export]
pub fn compute_hash(path: &str, exclusions: &[Exclusion]) -> Result<Vec<u8>, Error> {
    let mut file = File::open(path.replace("file://", ""))?;
    let exclusions_range = exclusions.iter().map(Into::into).collect();
    let hash = hash_stream_by_alg("sha256", &mut file, Some(exclusions_range), true)?;

    Ok(hash)
}

#[uniffi::export]
pub fn verify_hash(path: &str, data_hash: &DataHash) -> Result<bool, Error> {
    let expected_hash = Base64::decode_vec(&data_hash.hash)?;
    let hash = compute_hash(path, &data_hash.exclusions)?;

    Ok(hash == expected_hash)
}
