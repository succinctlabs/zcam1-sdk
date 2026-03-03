use sp1_verifier::{GROTH16_VK_BYTES, Groth16Verifier};
use zcam1_ios::APPLE_ROOT_CERT;

use crate::error::VerifyError;

pub fn verify_proof_from_manifest(
    proof: &[u8],
    vk_hash: &str,
    photo_hash: &[u8],
    app_id: &str,
) -> Result<bool, VerifyError> {
    let mut public_inputs = vec![];

    public_inputs.extend_from_slice(photo_hash);
    public_inputs.extend_from_slice(app_id.as_bytes());
    public_inputs.extend_from_slice(APPLE_ROOT_CERT.as_bytes());

    verify_groth16(proof, &public_inputs, vk_hash)
}

/// Wrapper around [`sp1_verifier::Groth16Verifier::verify`].
///
/// We hardcode the Groth16 VK bytes to only verify SP1 proofs.
#[uniffi::export]
pub fn verify_groth16(
    proof: &[u8],
    public_inputs: &[u8],
    sp1_vk_hash: &str,
) -> Result<bool, VerifyError> {
    Groth16Verifier::verify(proof, public_inputs, sp1_vk_hash, *GROTH16_VK_BYTES)?;

    Ok(true)
}
