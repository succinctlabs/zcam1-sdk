use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error(transparent)]
    C2pa(#[from] zcam1_c2pa_utils::error::Error),

    #[error(transparent)]
    Base64(#[from] base64ct::Error),

    #[error(transparent)]
    Groth16(#[from] sp1_verifier::Groth16Error),

    #[error("Proof not found in the manifest")]
    ProofNotFound,
}
