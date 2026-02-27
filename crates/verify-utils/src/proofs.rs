use sp1_verifier::{GROTH16_VK_BYTES, Groth16Verifier};

use crate::error::VerifyError;

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
