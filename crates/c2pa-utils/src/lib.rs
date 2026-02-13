use std::{
    fs::File,
    io::{Cursor, Read, Seek},
    thread,
};

use c2pa::{hash_stream_by_alg, jumbf_io::get_assetio_handler, Reader};
use futures::channel::oneshot;

use crate::{
    error::C2paError,
    types::{AuthenticityStatus, ManifestStore},
};

pub mod error;

pub mod types;

#[cfg(feature = "editor")]
mod manifest_editor;

#[cfg(all(feature = "editor", any(target_os = "macos", target_os = "ios")))]
mod signing;

uniffi::setup_scaffolding!();

#[cfg(feature = "editor")]
pub use manifest_editor::ManifestEditor;

#[uniffi::export]
#[cfg(feature = "io")]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, C2paError> {
    let reader = Reader::from_file(path.replace("file://", ""))?;

    // `Reader::json()` and `Reader::detailed_json()` returns 2 differents things:
    //
    // The manifests from the `manifests` map returned by `Reader::json()` can be
    // deserialized to `ManifestDefinition` and thus can be used in
    // `Builder::from_json`.
    // The drawback of `Reader::json()` is the the data hash is not included.
    //
    // The data hash is included when using `Reader::detailed_json()`, but
    // the manifests can't be deserialized to `ManifestDefinition`.
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

#[cfg(all(feature = "io", feature = "editor"))]
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

/// Compute the hash for a file.
///
/// Note: the file should **not** have a C2PA manifest embedded.
#[cfg(feature = "io")]
#[uniffi::export]
pub fn compute_hash(path: &str) -> Result<Vec<u8>, C2paError> {
    let path = path.strip_prefix("file://").unwrap_or(path);
    let format = format_from_path(path).ok_or_else(|| C2paError::FormatNotSupported)?;

    let mut file = File::open(path)?;

    let file_size = file.metadata()?.len() as usize;

    compute_hash_from_stream(&mut file, file_size, &format)
}

#[uniffi::export]
pub fn compute_hash_from_buffer(buffer: Vec<u8>, format: &str) -> Result<Vec<u8>, C2paError> {
    let stream = Cursor::new(&buffer);

    compute_hash_from_stream(stream, buffer.len(), format)
}

pub fn compute_hash_from_stream<S: Read + Seek + Send>(
    mut stream: S,
    stream_size: usize,
    format: &str,
) -> Result<Vec<u8>, C2paError> {
    let assetio = get_assetio_handler(format).ok_or_else(|| C2paError::FormatNotSupported)?;
    let writer = assetio
        .get_writer(format)
        .ok_or_else(|| C2paError::FormatNotSupported)?;

    let buffer = Vec::with_capacity(stream_size);
    let mut without_manifest = Cursor::new(buffer);

    writer.remove_cai_store_from_stream(&mut stream, &mut without_manifest)?;

    let hash = hash_stream_by_alg("sha256", &mut without_manifest, None, true)?;

    Ok(hash)
}
