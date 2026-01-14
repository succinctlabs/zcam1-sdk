use std::{
    fs::File,
    io::{Read, Seek},
    thread,
};

use base64ct::{Base64, Encoding};
use c2pa::{hash_stream_by_alg, Reader};
use futures::channel::oneshot;

use crate::{
    error::C2paError,
    types::{AuthenticityStatus, DataHash, Exclusion, ManifestStore},
};

pub mod error;

pub mod types;

#[cfg(feature = "editor")]
mod manifest_editor;

#[cfg(feature = "editor")]
mod signing;

uniffi::setup_scaffolding!();

#[cfg(feature = "editor")]
pub use manifest_editor::ManifestEditor;

#[uniffi::export]
#[cfg(feature = "io")]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, C2paError> {
    let reader = Reader::from_file(path.replace("file://", ""))?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}

pub fn extract_manifest_from_stream(
    format: &str,
    stream: impl Read + Seek + Send,
) -> Result<ManifestStore, C2paError> {
    let reader = Reader::from_stream(format, stream)?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}

/// Return a MIME type given a file path.
///
/// This function will use the file extension to determine the MIME type.
#[uniffi::export]
pub fn format_from_path(path: &str) -> Option<String> {
    c2pa::format_from_path(path)
}

#[cfg(feature = "io")]
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

#[cfg(feature = "io")]
#[uniffi::export]
pub fn compute_hash(path: &str, exclusions: &[Exclusion]) -> Result<Vec<u8>, C2paError> {
    let mut file = File::open(path.replace("file://", ""))?;
    compute_hash_from_stream(&mut file, exclusions)
}

pub fn compute_hash_from_stream<R>(
    stream: &mut R,
    exclusions: &[Exclusion],
) -> Result<Vec<u8>, C2paError>
where
    R: Read + Seek + ?Sized,
{
    let exclusions_range = exclusions.iter().map(Into::into).collect();
    let hash = hash_stream_by_alg("sha256", stream, Some(exclusions_range), true)?;

    Ok(hash)
}

#[cfg(feature = "io")]
#[uniffi::export]
pub fn verify_hash(path: &str, data_hash: &DataHash) -> Result<bool, C2paError> {
    let expected_hash = Base64::decode_vec(&data_hash.hash)?;
    let hash = compute_hash(path, &data_hash.exclusions)?;

    Ok(hash == expected_hash)
}
