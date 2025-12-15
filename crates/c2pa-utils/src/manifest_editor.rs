use std::{
    cmp,
    fs::{self, File},
    io::{Cursor, Seek, Write},
    sync::{Arc, RwLock},
};

use c2pa::{
    assertions::DataHash, settings::Settings, AsyncSigner, Builder, CallbackSigner,
    ClaimGeneratorInfo, HashRange, Reader, SigningAlg,
};
use serde_json::Value;

use crate::{
    error::Error,
    signing::{sign_with_enclave, SIMULATOR_TEST_KEY_ID, SIMULATOR_TEST_PRIVATE_KEY_PEM},
    types::{Exclusion, ManifestStore},
};

#[derive(Debug, uniffi::Object)]
pub struct ManifestEditor {
    source_file_path: String,
    exclusions: Vec<Exclusion>,
    builder: Arc<RwLock<Builder>>,
}

#[uniffi::export]
impl ManifestEditor {
    #[uniffi::constructor(name = "new")]
    pub fn new(path: &str) -> Self {
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
        }
    }

    #[uniffi::constructor()]
    pub fn from_file_and_manifest(path: &str, manifest: &ManifestStore) -> Result<Self, Error> {
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

        let editor = Self {
            source_file_path: path.to_string(),
            builder: Arc::new(RwLock::new(builder)),
            exclusions,
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
        hash: Vec<u8>,
        format: &str,
        key_tag: Vec<u8>,
        certs: &str,
    ) -> Result<(), Error> {
        let mut builder = {
            let mut guard = self.builder.write().map_err(|_| Error::Poisoned)?;
            std::mem::take(&mut *guard)
        };

        // Check if this is simulator mode by comparing key_tag with SIMULATOR_TEST_KEY_ID.
        let is_simulator = key_tag.as_slice() == SIMULATOR_TEST_KEY_ID;

        let final_manifest = if is_simulator {
            eprintln!("[ZCAM DEBUG] Using CallbackSigner with test key for simulator mode");

            // Use CallbackSigner with test key for simulator mode (no keychain access needed).
            use p256::ecdsa::{Signature, SigningKey, signature::Signer};
            use p256::SecretKey;
            use std::sync::Arc;

            // Parse the test private key once (SEC1 format).
            let secret_key = SecretKey::from_sec1_pem(SIMULATOR_TEST_PRIVATE_KEY_PEM)
                .map_err(|e| Error::Other(format!("Failed to parse test private key: {}", e)))?;
            let signing_key = Arc::new(SigningKey::from(&secret_key));

            let signer = CallbackSigner::new(
                move |_context, data: &[u8]| {
                    eprintln!("[ZCAM DEBUG] CallbackSigner: Signing with test key in simulator mode");
                    eprintln!("[ZCAM DEBUG] CallbackSigner: Data to sign length: {} bytes", data.len());

                    // Sign the data.
                    let signature: Signature = signing_key.sign(data);

                    // Get the P1363 format (raw r||s bytes).
                    let p1363_bytes = signature.to_bytes().to_vec();

                    eprintln!("[ZCAM DEBUG] CallbackSigner: Generated P1363 signature length: {} bytes", p1363_bytes.len());
                    eprintln!("[ZCAM DEBUG] CallbackSigner: First 16 bytes: {:02x?}", &p1363_bytes[..16.min(p1363_bytes.len())]);

                    // Verify this is NOT DER format by checking if it starts with 0x30 (DER SEQUENCE tag).
                    if !p1363_bytes.is_empty() && p1363_bytes[0] == 0x30 {
                        eprintln!("[ZCAM ERROR] CallbackSigner: WARNING - Signature appears to be DER format!");
                    } else {
                        eprintln!("[ZCAM DEBUG] CallbackSigner: Signature is in P1363 format (not DER)");
                    }

                    // Return the signature in P1363 format (raw r||s bytes).
                    // This avoids triggering DER-to-P1363 conversion in c2pa-rs which would
                    // require certificate chain lookup.
                    Ok(p1363_bytes)
                },
                SigningAlg::Es256,
                certs,
            );

            let placeholder_manifest =
                builder.data_hashed_placeholder(signer.reserve_size(), format)?;

            self.create_signed_manifest(&mut builder, signer, placeholder_manifest, hash, format).await?
        } else {
            eprintln!("[ZCAM DEBUG] Using CallbackSigner for real device mode");

            // Use CallbackSigner for real device (Secure Enclave).
            let signer = CallbackSigner::new(
                move |_context, data: &[u8]| {
                    sign_with_enclave(&key_tag, data)
                        .map_err(|err| c2pa::Error::InternalError(err.to_string()))
                },
                SigningAlg::Es256,
                certs,
            );

            let placeholder_manifest =
                builder.data_hashed_placeholder(signer.reserve_size(), format)?;

            self.create_signed_manifest(&mut builder, signer, placeholder_manifest, hash, format).await?
        };

        // Put the updated builder back into the RwLock.
        {
            let mut guard = self.builder.write().map_err(|_| Error::Poisoned)?;
            *guard = builder;
        }

        // Write the complete output (image with embedded signed manifest) to the destination file.
        let mut output_file = File::create(destination.replace("file://", ""))?;
        output_file.write_all(&final_manifest)?;

        Ok(())
    }
}

// Private helper methods (not exported via uniffi).
impl ManifestEditor {
    // Helper method to create the signed manifest (same logic for both signers).
    async fn create_signed_manifest<S: AsyncSigner>(
        &self,
        builder: &mut Builder,
        signer: S,
        placeholder_manifest: Vec<u8>,
        hash: Vec<u8>,
        format: &str,
    ) -> Result<Vec<u8>, Error> {

        let bytes = self.strip_exclusions_from_source()?;
        let mut output: Vec<u8> = Vec::with_capacity(bytes.len() + placeholder_manifest.len());

        // Generate new file inserting unfinished manifest into file.
        // Figure out where you want to put the manifest.
        // Here we put it at the beginning of the JPEG as first segment after the 2 byte SOI marker.
        let manifest_pos = 2;
        output.extend_from_slice(&bytes[0..manifest_pos]);
        output.extend_from_slice(&placeholder_manifest);
        output.extend_from_slice(&bytes[manifest_pos..]);

        let mut output_stream = Cursor::new(output);
        let mut data_hash = DataHash::new("manifest", "sha256");
        let hr = HashRange::new(manifest_pos as u64, placeholder_manifest.len() as u64);

        data_hash.add_exclusion(hr.clone());
        data_hash.set_hash(hash);

        // Tell SDK to fill in the hash and sign to complete the manifest.
        let final_manifest = builder
            .sign_data_hashed_embeddable_async(&signer, &data_hash, "image/jpeg")
            .await?;

        // Replace the placeholder manifest with the final signed manifest.
        output_stream.seek(std::io::SeekFrom::Start(manifest_pos as u64))?;
        output_stream.write_all(&final_manifest)?;
        output_stream.rewind()?;

        // Make sure the output stream is correct.
        let _ = Reader::from_stream(format, &mut output_stream)?;

        // Return the complete output with embedded signed manifest.
        Ok(output_stream.into_inner())
    }
}

impl ManifestEditor {
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
