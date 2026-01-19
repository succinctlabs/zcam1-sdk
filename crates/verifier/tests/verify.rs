use zcam1_verifier::ios::verify_proof;

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof.jpg";

#[test]
fn test_verify_proof() {
    let is_valid = verify_proof(IMAGE_WITH_VALID_PROOF).unwrap();

    assert!(is_valid)
}
