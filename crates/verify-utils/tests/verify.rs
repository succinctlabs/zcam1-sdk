use zcam1_verify_utils::ios::verify_proof;

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof.jpg";

#[test]
fn test_verify_proof() {
    let is_valid = verify_proof(
        IMAGE_WITH_VALID_PROOF,
        "NLS5R4YCGX.com.anonymous.zcam1-e2e-example".to_string(),
    )
    .unwrap();

    assert!(is_valid)
}
