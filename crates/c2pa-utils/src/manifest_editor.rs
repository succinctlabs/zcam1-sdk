use std::{
    fs::File,
    sync::{Arc, RwLock},
};

use c2pa::{
    settings::Settings, AsyncSigner, Builder, BuilderIntent, CallbackSigner, ClaimGeneratorInfo,
    DigitalSourceType, SigningAlg,
};
use serde_json::Value;

use crate::{error::C2paError, signing::sign_with_enclave};

#[derive(uniffi::Object)]
pub struct ManifestEditor {
    source_file_path: String,
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
            signer: Box::new(signer),
        }
    }

    #[uniffi::constructor()]
    pub fn from_file(path: &str, key_tag: Vec<u8>, certs: &str) -> Result<Self, C2paError> {
        let signer = CallbackSigner::new(
            move |_context, data: &[u8]| {
                sign_with_enclave(&key_tag, data)
                    .map_err(|err| c2pa::Error::InternalError(err.to_string()))
            },
            SigningAlg::Es256,
            certs,
        );

        Self::from_file_with_signer(path, signer)
    }

    pub fn add_title(&self, title: &str) -> Result<(), C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;

        builder.definition.title = Some(title.to_string());

        Ok(())
    }

    pub fn add_action(&self, data: &str) -> Result<(), C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;
        let data = serde_json::from_str::<Value>(data)?;

        builder.add_action(&data)?;

        Ok(())
    }

    pub fn add_assertion(&self, label: &str, data: &str) -> Result<(), C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;
        let data = serde_json::from_str::<Value>(data)?;

        builder.add_assertion(label, &data)?;

        Ok(())
    }

    pub fn remove_assertion(&self, label: &str) -> Result<bool, C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;
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
    ) -> Result<(), C2paError> {
        let mut builder = {
            let mut guard = self.builder.write().map_err(|_| C2paError::Poisoned)?;
            std::mem::take(&mut *guard)
        };

        let mut input_stream = File::open(&self.source_file_path)?;
        let destination = destination.replace("file://", "");
        let mut output_file = File::create(destination)?;

        builder
            .sign_async(&*self.signer, format, &mut input_stream, &mut output_file)
            .await?;

        // Put the updated builder back into the RwLock
        {
            let mut guard = self.builder.write().map_err(|_| C2paError::Poisoned)?;
            *guard = builder;
        }

        Ok(())
    }
}

impl ManifestEditor {
    pub fn from_file_with_signer<S: AsyncSigner + Send + 'static>(
        path: &str,
        signer: S,
    ) -> Result<Self, C2paError> {
        Settings::from_toml(include_str!("../c2pa_settings.toml")).unwrap();

        let mut builder = Builder::new();

        builder.set_intent(BuilderIntent::Create(DigitalSourceType::DigitalCapture));

        builder
            .definition
            .claim_generator_info
            .push(ClaimGeneratorInfo::new("ZCAM1"));
        builder.definition.vendor = Some("Succinct".to_string());

        //if let Some(capture) = active_manifest.action("c2pa.capture".to_string()) {
        //    builder.add_action(capture)?;
        //}

        //exclusions.sort_by_key(|e| e.start);

        let editor = Self {
            source_file_path: path.to_string(),
            builder: Arc::new(RwLock::new(builder)),
            signer: Box::new(signer),
        };

        Ok(editor)
    }

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
            signer: Box::new(signer),
        }
    }
}
