use std::{
    cmp,
    fs::{self, File},
    io::Cursor,
    sync::{Arc, RwLock},
};

use c2pa::{
    settings::Settings, AsyncSigner, Builder, CallbackSigner, ClaimGeneratorInfo, SigningAlg,
};
use serde_json::Value;

use crate::{
    error::Error,
    signing::sign_with_enclave,
    types::{Exclusion, ManifestStore},
};

#[derive(uniffi::Object)]
pub struct ManifestEditor {
    source_file_path: String,
    exclusions: Vec<Exclusion>,
    builder: Arc<RwLock<Builder>>,
    signer: Box<dyn AsyncSigner + Send>,
}

#[uniffi::export]
impl ManifestEditor {
    #[uniffi::constructor(name = "new")]
    pub fn new(path: &str, key_tag: Vec<u8>, certs: &str) -> Self {
        Settings::from_toml(include_str!("../c2pa_settings.toml")).unwrap();

        let mut builder = Builder::new();

        builder
            .definition
            .claim_generator_info
            .push(ClaimGeneratorInfo::new("ZCAM1"));
        builder.definition.vendor = Some("Succinct".to_string());

        let signer = CallbackSigner::new(
            move |_context, data: &[u8]| {
                sign_with_enclave(&key_tag, data)
                    .map_err(|err| c2pa::Error::InternalError(err.to_string()))
            },
            SigningAlg::Es256,
            certs,
        );

        Self {
            builder: Arc::new(RwLock::new(builder)),
            source_file_path: path.to_string(),
            exclusions: vec![],
            signer: Box::new(signer),
        }
    }

    #[uniffi::constructor()]
    pub fn from_file_and_manifest(
        path: &str,
        manifest: &ManifestStore,
        key_tag: Vec<u8>,
        certs: &str,
    ) -> Result<Self, Error> {
        Settings::from_toml(include_str!("../c2pa_settings.toml")).unwrap();

        let active_manifest = manifest.active_manifest()?;
        let mut exclusions = active_manifest.data_hash().exclusions.clone();

        let mut builder = Builder::new();

        builder
            .definition
            .claim_generator_info
            .push(ClaimGeneratorInfo::new("ZCAM1"));
        builder.definition.vendor = Some("Succinct".to_string());

        if let Some(capture) = active_manifest.action("c2pa.capture") {
            builder.add_action(capture)?;
        }

        exclusions.sort_by_key(|e| e.start);

        let signer = CallbackSigner::new(
            move |_context, data: &[u8]| {
                sign_with_enclave(&key_tag, data)
                    .map_err(|err| c2pa::Error::InternalError(err.to_string()))
            },
            SigningAlg::Es256,
            certs,
        );

        let editor = Self {
            source_file_path: path.to_string(),
            builder: Arc::new(RwLock::new(builder)),
            exclusions,
            signer: Box::new(signer),
        };

        Ok(editor)
    }

    pub fn add_title(&self, title: &str) -> Result<(), Error> {
        let mut builder = self.builder.write().map_err(|_| Error::Poisoned)?;

        builder.definition.title = Some(title.to_string());

        Ok(())
    }

    pub fn add_action(&self, data: &str) -> Result<(), Error> {
        let mut builder = self.builder.write().map_err(|_| Error::Poisoned)?;
        let data = serde_json::from_str::<Value>(data)?;

        builder.add_action(&data)?;

        Ok(())
    }

    pub fn add_assertion(&self, label: &str, data: &str) -> Result<(), Error> {
        let mut builder = self.builder.write().map_err(|_| Error::Poisoned)?;
        let data = serde_json::from_str::<Value>(data)?;

        builder.add_assertion(label, &data)?;

        Ok(())
    }

    pub fn remove_assertion(&self, label: &str) -> Result<bool, Error> {
        let mut builder = self.builder.write().map_err(|_| Error::Poisoned)?;
        if let Some(index) = builder
            .definition
            .assertions
            .iter()
            .position(|def| def.label == label)
        {
            builder.definition.assertions.remove(index);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn embed_manifest_to_file(
        &self,
        destination: &str,
        format: &str,
    ) -> Result<(), Error> {
        let mut builder = {
            let mut guard = self.builder.write().map_err(|_| Error::Poisoned)?;
            std::mem::take(&mut *guard)
        };

        let input_bytes = self.strip_exclusions_from_source()?;
        let mut input_stream = Cursor::new(input_bytes);
        let destination = destination.replace("file://", "");
        let mut output_file = File::open(destination)?;

        builder
            .sign_async(&*self.signer, format, &mut input_stream, &mut output_file)
            .await?;

        // Put the updated builder back into the RwLock
        {
            let mut guard = self.builder.write().map_err(|_| Error::Poisoned)?;
            *guard = builder;
        }

        Ok(())
    }

    async fn embed_manifest_to_jpeg(&self) {}
}

impl ManifestEditor {
    pub fn with_signer<S: AsyncSigner + Send + 'static>(path: &str, signer: S) -> Self {
        Settings::from_toml(include_str!("../c2pa_settings.toml")).unwrap();

        let mut builder = Builder::new();

        builder
            .definition
            .claim_generator_info
            .push(ClaimGeneratorInfo::new("ZCAM1"));
        builder.definition.vendor = Some("Succinct".to_string());

        Self {
            builder: Arc::new(RwLock::new(builder)),
            source_file_path: path.to_string(),
            exclusions: vec![],
            signer: Box::new(signer),
        }
    }

    fn strip_exclusions_from_source(&self) -> Result<Vec<u8>, Error> {
        let source = fs::read(&self.source_file_path)?;
        let mut dest = Vec::with_capacity(source.len());

        // 'cursor' tracks the index up to which we have processed/skipped in source
        let mut cursor: usize = 0;

        for ex in &self.exclusions {
            let ex_start = ex.start as usize;
            let ex_end = ex_start + ex.length as usize;

            if ex_start >= source.len() {
                break;
            }

            if ex_start > cursor {
                dest.extend_from_slice(&source[cursor..ex_start]);
            }

            cursor = cmp::max(cursor, ex_end);
        }

        if cursor < source.len() {
            dest.extend_from_slice(&source[cursor..]);
        }

        Ok(dest)
    }
}
