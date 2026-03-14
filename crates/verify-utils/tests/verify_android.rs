use std::error::Error;

use base64ct::{Base64, Encoding};
use zcam1_c2pa_utils::{compute_hash, extract_manifest};
use zcam1_verify_utils::{error::VerifyError, proofs::verify_proof_from_manifest};

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof_android.jpg";

#[test]
fn test_verify_proof() -> Result<(), Box<dyn Error>> {
    let store = extract_manifest(IMAGE_WITH_VALID_PROOF)?;
    let hash = compute_hash(IMAGE_WITH_VALID_PROOF)?;
    let active_manifest = store.active_manifest()?;
    let proof = active_manifest
        .proof()
        .ok_or_else(|| VerifyError::ProofNotFound)?;

    let is_valid = verify_proof_from_manifest(
        &Base64::decode_vec(&proof.data)?,
        &proof.vk_hash,
        &hash,
        "com.anonymous.zcam1_e2e_example",
        &proof.platform,
    )?;

    assert!(is_valid);

    Ok(())
}
