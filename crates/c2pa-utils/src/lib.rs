use std::{
    fs::{self, File},
    io::{copy, Cursor, Seek, Write},
    path::PathBuf,
};

use c2pa::{assertions::DataHash, AsyncSigner, Builder, CallbackSigner, Reader, SigningAlg};

use crate::{error::Error, signing::sign_with_enclave, types::ManifestStore};

mod error;
mod signing;
mod types;

uniffi::setup_scaffolding!();

#[uniffi::export]
pub fn extract_manifest(path: &str) -> Result<ManifestStore, Error> {
    let reader = Reader::from_file(path.replace("file://", ""))?;
    let store = serde_json::from_str::<ManifestStore>(&reader.detailed_json())?;

    Ok(store)
}

#[uniffi::export]
pub async fn embed_manifest(
    source: &str,
    destination: &str,
    manifest_json: &str,
    hash: Vec<u8>,
    format: &str,
    key_tag: Vec<u8>,
    certs: &str,
) -> Result<(), Error> {
    let source = PathBuf::from(source);
    let mut builder = Builder::from_json(manifest_json)?;

    let signer = CallbackSigner::new(
        move |_context, data: &[u8]| {
            sign_with_enclave(&key_tag, data)
                .map_err(|err| c2pa::Error::InternalError(err.to_string()))
        },
        SigningAlg::Es256,
        certs,
    );

    let placeholder_manifest = builder.data_hashed_placeholder(signer.reserve_size(), format)?;

    let bytes = fs::read(&source)?;
    let mut output: Vec<u8> = Vec::with_capacity(bytes.len() + placeholder_manifest.len());

    // Generate new file inserting unfinished manifest into file.
    // Figure out where you want to put the manifest.
    // Here we put it at the beginning of the JPEG as first segment after the 2 byte SOI marker.
    let manifest_pos = 2;
    output.extend_from_slice(&bytes[0..manifest_pos]);
    output.extend_from_slice(&placeholder_manifest);
    output.extend_from_slice(&bytes[manifest_pos..]);

    let mut output_stream = Cursor::new(output);
    let mut data_hash = DataHash::new("manifest", "sha265");

    data_hash.set_hash(hash);

    // tell SDK to fill in the hash and sign to complete the manifest
    let final_manifest = builder
        .sign_data_hashed_embeddable_async(&signer, &data_hash, "image/jpeg")
        .await?;

    output_stream.seek(std::io::SeekFrom::Start(2))?;
    output_stream.write_all(&final_manifest)?;
    output_stream.rewind()?;

    let mut output_file = File::create(destination)?;

    let _ = copy(&mut output_stream, &mut output_file)?;

    // make sure the output stream is correct
    //let _ = Reader::from_stream(format, &mut output_stream)?;

    Ok(())
}
