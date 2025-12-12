use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error(transparent)]
    C2pa(#[from] c2pa::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Base64(#[from] base64ct::Error),

    #[error("No active manifest")]
    NoActiveManifest,

    #[error("The lock has been poisoned")]
    Poisoned,

    #[error("{0}")]
    Other(String),
}

impl From<Error> for c2pa::Error {
    fn from(value: Error) -> Self {
        match value {
            Error::C2pa(error) => error,
            Error::Json(error) => c2pa::Error::JsonError(error),
            Error::Io(error) => c2pa::Error::IoError(error),
            Error::Other(msg) => c2pa::Error::InternalError(msg),
            other => c2pa::Error::OtherError(Box::new(other)),
        }
    }
}
