use base64ct::{Base64, Encoding};
use sp1_verifier::{GROTH16_VK_BYTES, Groth16Verifier};
use zcam1_c2pa_utils::{compute_hash, extract_manifest};

use crate::error::VerifyError;

/// Extracts the manifest from a file at `path`, then verifies the proof.
///
/// In production mode, only proofs where hardware attestation was verified
/// inside the ZK circuit are accepted (`hardware_attested = 1`).
pub fn verify_proof_from_file(
    path: &str,
    app_id: &str,
    production: bool,
) -> Result<bool, VerifyError> {
    let manifest_store = extract_manifest(path)?;
    let active_manifest = manifest_store.active_manifest()?;
    let proof = active_manifest
        .proof()
        .ok_or_else(|| VerifyError::ProofNotFound)?;
    let photo_hash = compute_hash(path)?;

    verify_proof_from_manifest(
        &Base64::decode_vec(&proof.data)?,
        &proof.vk_hash,
        &photo_hash,
        app_id,
        &proof.platform,
        production,
    )
}

/// Verifies a Groth16 proof from a C2PA manifest.
///
/// The SP1 program commits `(photo_hash, app_id, root_certs, hardware_attested)`
/// as public outputs. `hardware_attested` is `1` if real hardware attestation was
/// verified inside the ZK circuit, `0` if attestation was skipped (simulator).
///
/// In production mode, only `hardware_attested = 1` proofs are accepted.
/// In dev mode, both are accepted (tries `1` first, falls back to `0`).
#[uniffi::export]
pub fn verify_proof_from_manifest(
    proof: &[u8],
    vk_hash: &str,
    photo_hash: &[u8],
    app_id: &str,
    platform: &str,
    production: bool,
) -> Result<bool, VerifyError> {
    let mut public_inputs = vec![];

    public_inputs.extend_from_slice(photo_hash);
    public_inputs.extend_from_slice(app_id.as_bytes());

    match platform {
        "android" => {
            public_inputs.extend_from_slice(
                format!(
                    "{}{}",
                    zcam1_android::GOOGLE_HARDWARE_ROOT_RSA,
                    zcam1_android::GOOGLE_HARDWARE_ROOT_EC,
                )
                .as_bytes(),
            );
        }
        "ios" | "macos" => {
            public_inputs.extend_from_slice(zcam1_ios::APPLE_ROOT_CERT.as_bytes());
        }
        other => return Err(VerifyError::PlatformNotSupported(other.to_string())),
    }

    if production {
        // Production: require hardware_attested = 1
        public_inputs.push(1u8);
        verify_groth16(proof, &public_inputs, vk_hash)
    } else {
        // Dev: accept either hardware_attested value (try 1 first, fall back to 0)
        let mut inputs_attested = public_inputs.clone();
        inputs_attested.push(1u8);
        if verify_groth16(proof, &inputs_attested, vk_hash).is_ok() {
            return Ok(true);
        }
        public_inputs.push(0u8);
        verify_groth16(proof, &public_inputs, vk_hash)
    }
}

/// Wrapper around [`sp1_verifier::Groth16Verifier::verify`].
///
/// We hardcode the Groth16 VK bytes to only verify SP1 proofs.
pub fn verify_groth16(
    proof: &[u8],
    public_inputs: &[u8],
    sp1_vk_hash: &str,
) -> Result<bool, VerifyError> {
    Groth16Verifier::verify(proof, public_inputs, sp1_vk_hash, *GROTH16_VK_BYTES)?;

    Ok(true)
}
