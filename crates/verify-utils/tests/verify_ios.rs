use std::error::Error;

use zcam1_verify_utils::proofs::verify_proof_from_file;

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof_ios.jpg";

#[test]
fn test_verify_proof() -> Result<(), Box<dyn Error>> {
    let is_valid = verify_proof_from_file(
        IMAGE_WITH_VALID_PROOF,
        "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
    )?;

    assert!(is_valid);

    Ok(())
}
