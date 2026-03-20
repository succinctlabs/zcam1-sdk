pub mod certificate;
pub mod constants;
pub mod error;
pub mod extension;
pub mod key_attestation;
pub mod signature;
pub mod types;

pub use constants::{GOOGLE_HARDWARE_ROOT_EC, GOOGLE_HARDWARE_ROOT_RSA};
pub use error::{Error, SecurityLevel};
pub use key_attestation::validate_key_attestation;
pub use signature::{verify_message_binding, verify_signature};
pub use types::{KeyAttestationResult, KeyDescription, RootOfTrust, VerifiedBootState};

/// Convenience function to validate all Android attestation artifacts in one call.
///
/// Validates the key attestation chain and then verifies the signature.
pub fn validate_attestation(
    attestation: &str,
    signature: &str,
    message: &str,
    expected_challenge: &str,
    expected_package_name: &str,
) -> Result<(), Error> {
    let key_result =
        validate_key_attestation(attestation, expected_challenge, expected_package_name)?;

    verify_signature(signature, message, &key_result.public_key_hex)?;

    Ok(())
}
