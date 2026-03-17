use zcam1_verify_utils::{bindings::verify_bindings_from_file, ios::verify_proof};

const IMAGE_WITH_VALID_BINDINGS: &str = "./tests/fixtures/with_bindings.jpg";
const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof.jpg";
#[test]
fn test_verify_bindings() {
    let is_valid = verify_bindings_from_file(IMAGE_WITH_VALID_BINDINGS, false).unwrap();

    assert!(is_valid);
}

#[test]
fn test_verify_proof() {
    let is_valid = verify_proof(
        IMAGE_WITH_VALID_PROOF,
        "NLS5R4YCGX.com.anonymous.zcam1-e2e-example".to_string(),
    )
    .unwrap();

    assert!(is_valid);
}
