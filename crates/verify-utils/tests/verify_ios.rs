use std::error::Error;

use zcam1_verify_utils::proofs::verify_proof_from_file;

const IMAGE_WITH_VALID_PROOF: &str = "./tests/fixtures/with_proof_ios.jpg";

// TODO: Re-enable after regenerating proof fixture with updated SP1 program
// (new program commits hardware_attested flag, changing the VK hash)
#[test]
#[ignore]
fn test_verify_proof() -> Result<(), Box<dyn Error>> {
    let is_valid = verify_proof_from_file(
        IMAGE_WITH_VALID_PROOF,
        "NLS5R4YCGX.com.anonymous.zcam1-e2e-example",
        false, // dev mode: accept both hardware_attested values
    )?;

    assert!(is_valid);

    Ok(())
}
