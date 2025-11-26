use thiserror::Error;
use zcam1_ios::{IosRegisterInputs, IosVerifier, validate_attestation};

pub trait Verifier {
    type Inputs;

    fn bootstrap_verify(
        &self,
        inputs: &Self::Inputs,
        expected_challenge: String,
    ) -> Result<bool, VerifierError>;
}

impl Verifier for IosVerifier {
    type Inputs = IosRegisterInputs;

    fn bootstrap_verify(
        &self,
        inputs: &IosRegisterInputs,
        expected_challenge: String,
    ) -> Result<bool, VerifierError> {
        let result = validate_attestation(
            &inputs.attestation,
            &inputs.key_id,
            &expected_challenge,
            &inputs.app_id,
            inputs.production,
            false,
        );

        Ok(result.is_ok())
    }
}

#[derive(Error, Debug)]
pub enum VerifierError {
    #[error("Failed to deserialize attestation")]
    AttestationDeserializationFailed(#[source] eyre::Error),
    #[error("Failed to verify")]
    VerificationFailed(#[source] eyre::Error),
}
