use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error("{0}")]
    C2PA(#[from] c2pa::Error),
}

impl From<Error> for c2pa::Error {
    fn from(value: Error) -> Self {
        match value {
            Error::C2PA(error) => error,
        }
    }
}
