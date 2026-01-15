use zcam1_c2pa_utils::extract_manifest;
use zcam1_verifier::{ios::verify_proof, verify_hash};

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof.jpg";

#[test]
fn test_verify_hash() {
    let store = extract_manifest(IMAGE_WITH_VALID_PROOF).unwrap();
    let active_manifest = store.active_manifest().unwrap();
    let hash = active_manifest.hash();
    let is_valid = verify_hash(IMAGE_WITH_VALID_PROOF, hash).unwrap();

    assert!(is_valid)
}

#[test]
fn test_verify_proof() {
    let is_valid = verify_proof(IMAGE_WITH_VALID_PROOF).unwrap();

    assert!(is_valid)
}
