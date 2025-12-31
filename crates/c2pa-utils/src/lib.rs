use std::{fs::File, thread};

use base64ct::{Base64, Encoding};
use c2pa::{hash_stream_by_alg, Reader};
use futures::channel::oneshot;

use crate::{
    error::C2paError,
    types::{AuthenticityStatus, DataHash, Exclusion, ManifestStore},
};

pub mod error;
mod manifest_editor;
mod signing;
pub mod types;

uniffi::setup_scaffolding!();

pub use manifest_editor::ManifestEditor;

#[uniffi::export]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, C2paError> {
    let reader = Reader::from_file(path.replace("file://", ""))?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}

#[uniffi::export]
pub async fn authenticity_status(path: &str) -> AuthenticityStatus {
    let path = path.to_string();
    let (sender, receiver) = oneshot::channel();

    thread::spawn(move || {
        let status = match Reader::from_file(path.replace("file://", "")) {
            Ok(reader) => {
                match serde_json::from_str::<ManifestStore>(&reader.detailed_json())
                    .map_err(C2paError::Json)
                    .and_then(|store| store.active_manifest())
                {
                    Ok(active_manifest) => {
                        match (active_manifest.bindings(), active_manifest.proof()) {
                            (Some(_), None) => AuthenticityStatus::Bindings,
                            (None, Some(_)) => AuthenticityStatus::Proof,
                            (_, _) => AuthenticityStatus::InvalidManifest,
                        }
                    }
                    Err(_) => AuthenticityStatus::InvalidManifest,
                }
            }
            Err(_) => AuthenticityStatus::NoManifest,
        };
        let _ = sender.send(status);
    });

    receiver.await.unwrap()
}

#[uniffi::export]
pub fn compute_hash(path: &str, exclusions: &[Exclusion]) -> Result<Vec<u8>, C2paError> {
    let mut file = File::open(path.replace("file://", ""))?;
    let exclusions_range = exclusions.iter().map(Into::into).collect();
    let hash = hash_stream_by_alg("sha256", &mut file, Some(exclusions_range), true)?;

    Ok(hash)
}

#[uniffi::export]
pub fn verify_hash(path: &str, data_hash: &DataHash) -> Result<bool, C2paError> {
    let expected_hash = Base64::decode_vec(&data_hash.hash)?;
    let hash = compute_hash(path, &data_hash.exclusions)?;

    Ok(hash == expected_hash)
}
