use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error("Prover not initialized")]
    ProverNotInitialized,

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Sp1(String),
}
