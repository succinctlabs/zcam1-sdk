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

#[cfg(feature = "software-signing")]
use base64ct::{Base64UrlUnpadded, Encoding};
#[cfg(feature = "software-signing")]
use p256::{
    ecdsa::{signature::Signer, Signature, SigningKey},
    elliptic_curve::rand_core::OsRng,
};

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
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        {
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

        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            let _ = (path, key_tag, certs);
            panic!("ManifestEditor::new() with Secure Enclave signing is only available on Apple platforms")
        }
    }

    /// Creates a builder from a file that is expected to contain an existing C2PA manifest.
    ///
    /// The metadata included in the manifest are kept.
    #[uniffi::constructor()]
    pub fn from_manifest(path: &str, key_tag: Vec<u8>, certs: &str) -> Result<Self, C2paError> {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        {
            let signer = CallbackSigner::new(
                move |_context, data: &[u8]| {
                    sign_with_enclave(&key_tag, data)
                        .map_err(|err| c2pa::Error::InternalError(err.to_string()))
                },
                SigningAlg::Es256,
                certs,
            );

            let store = extract_manifest(path)?;

            Self::from_file_and_manifest_with_signer(path, &store.active_manifest()?, signer)
        }

        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            let _ = (path, key_tag, certs);
            Err(C2paError::Internal("ManifestEditor::from_manifest() with Secure Enclave signing is only available on Apple platforms".to_string()))
        }
    }

    /// Creates a ManifestEditor that uses an ephemeral software P-256 key for signing.
    ///
    /// This is intended for Android and other non-Apple platforms where Secure Enclave
    /// signing is not available. The signing key is generated in-memory and a matching
    /// self-signed certificate chain is created automatically.
    ///
    /// Hardware attestation should be included as a separate assertion in the manifest.
    #[uniffi::constructor(name = "new_with_software_key")]
    pub fn new_with_software_key(path: &str) -> Result<Self, C2paError> {
        #[cfg(feature = "software-signing")]
        {
            Settings::from_toml(include_str!("../c2pa_settings.toml")).map_err(|e| {
                C2paError::Internal(format!("Failed to load C2PA settings: {e}"))
            })?;

            let signing_key = SigningKey::random(&mut OsRng);
            let verifying_key = signing_key.verifying_key();
            let encoded_point = verifying_key.to_encoded_point(false);

            let x = encoded_point.x().ok_or_else(|| {
                C2paError::Internal("P-256 key missing x coordinate".to_string())
            })?;
            let y = encoded_point.y().ok_or_else(|| {
                C2paError::Internal("P-256 key missing y coordinate".to_string())
            })?;

            let jwk = zcam1_certs_utils::JwkEcKey {
                kty: "EC".to_string(),
                crv: "P-256".to_string(),
                x: Base64UrlUnpadded::encode_string(x),
                y: Base64UrlUnpadded::encode_string(y),
            };

            let certs =
                zcam1_certs_utils::build_self_signed_certificate(&jwk, None).map_err(|e| {
                    C2paError::Internal(format!("Failed to generate cert chain: {e}"))
                })?;

            let signer = CallbackSigner::new(
                move |_context, data: &[u8]| -> Result<Vec<u8>, c2pa::Error> {
                    let signature: Signature = signing_key.sign(data);
                    Ok(signature.to_der().as_bytes().to_vec())
                },
                SigningAlg::Es256,
                certs.as_bytes(),
            );

            let mut builder = Builder::new();
            builder
                .definition
                .claim_generator_info
                .push(ClaimGeneratorInfo::new("ZCAM1"));
            builder.definition.vendor = Some("Succinct".to_string());

            Ok(Self {
                builder: Arc::new(RwLock::new(builder)),
                source_file_path: path.to_string(),
                signer: Box::new(signer),
            })
        }

        #[cfg(not(feature = "software-signing"))]
        {
            let _ = path;
            Err(C2paError::Internal(
                "Software signing not enabled. Enable the 'software-signing' feature."
                    .to_string(),
            ))
        }
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
