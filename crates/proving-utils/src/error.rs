use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error("Prover not initialized")]
    ProverNotInitialized,

    #[error("Failed to parse a proof request Id: {0}")]
    FailedToParseProofRequestId(#[from] alloy_primitives::hex::FromHexError),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Sp1(String),
}
