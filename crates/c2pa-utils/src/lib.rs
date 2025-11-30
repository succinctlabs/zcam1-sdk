use std::{fmt::Debug, sync::Arc};

use c2pa::{Builder, CallbackSigner, Reader, SigningAlg, assertions::DataHash};

use crate::{error::Error, types::ManifestStore};

mod error;
mod types;

uniffi::setup_scaffolding!();

#[uniffi::export]
pub fn read_file(path: &str) -> String {
    let reader = Reader::from_file(path).unwrap();
    let value = serde_json::from_str::<ManifestStore>(&reader.detailed_json()).unwrap();

    println!("{value:#?}");

    String::from("Hello, world!")
}

#[uniffi::export]
pub fn embed_manifest(
    manifest_json: &str,
    hash: Vec<u8>,
    format: &str,
    certs: Vec<u8>,
    sign_callback: Arc<dyn SignerCallback>,
) {
    let mut builder = Builder::from_json(manifest_json).unwrap();
    let signer = CallbackSigner::new(
        move |_: *const (), data: &[u8]| sign_callback.sign(data.to_vec()).map_err(Into::into),
        SigningAlg::Es256,
        certs,
    );

    let mut data_hash = DataHash::new("name", "alg");

    data_hash.set_hash(hash);

    builder.sign_data_hashed_embeddable(&signer, &data_hash, format);

    todo!()
}

#[uniffi::export(with_foreign)]
pub trait SignerCallback: Send + Sync + Debug {
    fn sign(&self, data: Vec<u8>) -> Result<Vec<u8>, Error>;
}
