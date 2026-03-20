use std::{
    fs::File,
    sync::{Arc, RwLock},
};

use c2pa::{
    settings::Settings, AsyncSigner, Builder, CallbackSigner, ClaimGeneratorInfo, SigningAlg,
};
use serde_json::Value;
use serde_json_canonicalizer::to_string;

use crate::{
    error::C2paError,
    extract_manifest,
    types::{Action, Manifest, PhotoMetadataInfo, VideoMetadataInfo},
};

#[cfg(any(target_os = "macos", target_os = "ios"))]
use crate::signing::sign_with_enclave;

#[cfg(target_os = "android")]
use p256::ecdsa::{signature::Signer, Signature, SigningKey};

#[cfg(target_os = "android")]
use crate::android_signing::sign_with_android_keystore;

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

        let signer = build_signer(key_tag, certs).unwrap();

        Self {
            builder: Arc::new(RwLock::new(builder)),
            source_file_path: path.to_string(),
            signer: Box::new(signer),
        }
    }

    /// Creates a builder from a file that is expected to contain an existing C2PA manifest.
    ///
    /// The metadata included in the manifest are kept.
    #[uniffi::constructor()]
    pub fn from_manifest(path: &str, key_tag: Vec<u8>, certs: &str) -> Result<Self, C2paError> {
        let signer = build_signer(key_tag, certs)?;

        let store = extract_manifest(path)?;
        Self::from_file_and_manifest_with_signer(path, &store.active_manifest()?, signer)
    }

    pub fn add_title(&self, title: &str) -> Result<(), C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;

        builder.definition.title = Some(title.to_string());

        Ok(())
    }

    pub fn add_photo_metadata_action(
        &self,
        parameters: PhotoMetadataInfo,
        when: String,
    ) -> Result<String, C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;
        let metadata_action = Action::photo_metadata(when, parameters);

        builder.add_action(metadata_action.clone())?;

        Ok(to_string(&metadata_action)?)
    }

    pub fn add_video_metadata_action(
        &self,
        parameters: VideoMetadataInfo,
        when: String,
    ) -> Result<String, C2paError> {
        let mut builder = self.builder.write().map_err(|_| C2paError::Poisoned)?;
        let metadata_action = Action::video_metadata(when, parameters);

        builder.add_action(metadata_action.clone())?;

        Ok(to_string(&metadata_action)?)
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
    pub fn from_file_and_manifest_with_signer<S: AsyncSigner + Send + 'static>(
        path: &str,
        active_manifest: &Manifest,
        signer: S,
    ) -> Result<Self, C2paError> {
        Settings::from_toml(include_str!("../c2pa_settings.toml")).unwrap();

        let mut builder = Builder::new();

        builder
            .definition
            .claim_generator_info
            .push(ClaimGeneratorInfo::new("ZCAM1"));
        builder.definition.vendor = Some("Succinct".to_string());

        if let Some(capture) = active_manifest.action("succinct.capture") {
            builder.add_action(capture)?;
        }

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

fn build_signer(key_tag: Vec<u8>, certs: &str) -> Result<CallbackSigner, C2paError> {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    return Ok(CallbackSigner::new(
        move |_context, data: &[u8]| {
            sign_with_enclave(&key_tag, data)
                .map_err(|err| c2pa::Error::InternalError(err.to_string()))
        },
        SigningAlg::Es256,
        certs,
    ));

    #[cfg(target_os = "android")]
    return {
        let key_alias = String::from_utf8_lossy(&key_tag).to_string();
        if key_alias.contains("MOCK") {
            // Mock signing for emulator — hardware-backed key not available.
            // Uses a hardcoded P-256 key to produce a structurally valid ES256
            // Private key matching MOCK_EMULATOR_CONTENT_KEY in common.tsx
            const MOCK_KEY: [u8; 32] = [
                0x6f, 0xc7, 0x57, 0xbf, 0x65, 0x0b, 0x00, 0x08, 0x5e, 0xc6, 0x86, 0x56, 0x12, 0xb8,
                0x13, 0x71, 0xf9, 0x96, 0xee, 0x34, 0x90, 0x1e, 0x40, 0xe0, 0x06, 0xe0, 0xc2, 0x66,
                0x4c, 0x2c, 0xf5, 0xc8,
            ];
            Ok(CallbackSigner::new(
                move |_context, data: &[u8]| {
                    let key = SigningKey::from_bytes(&MOCK_KEY.into())
                        .map_err(|e| c2pa::Error::InternalError(e.to_string()))?;
                    let sig: Signature = key.sign(data);
                    Ok(sig.to_bytes().to_vec())
                },
                SigningAlg::Es256,
                certs,
            ))
        } else {
            Ok(CallbackSigner::new(
                move |_context, data: &[u8]| {
                    sign_with_android_keystore(&key_alias, data)
                        .map_err(|err| c2pa::Error::InternalError(err.to_string()))
                },
                SigningAlg::Es256,
                certs,
            ))
        }
    };

    Err(C2paError::Internal(
        "Signing is only availabale on iOS or Android".to_string(),
    ))
}
