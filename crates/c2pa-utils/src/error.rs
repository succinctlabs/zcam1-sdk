use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum C2paError {
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
}

impl From<C2paError> for c2pa::Error {
    fn from(value: C2paError) -> Self {
        match value {
            C2paError::C2pa(error) => error,
            C2paError::Json(error) => c2pa::Error::JsonError(error),
            C2paError::Io(error) => c2pa::Error::IoError(error),
            other => c2pa::Error::OtherError(Box::new(other)),
        }
    }
}
