use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error("Prover not initialized")]
    ProverNotInitialized,

    #[error("{0}")]
    Sp1(String),
}
