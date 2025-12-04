use c2pa::Reader;

use crate::{error::Error, types::ManifestStore};

mod error;
mod manifest_editor;
mod signing;
mod types;

uniffi::setup_scaffolding!();

pub use manifest_editor::ManifestEditor;

#[uniffi::export]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, Error> {
    let reader = Reader::from_file(path.replace("file://", ""))?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}
