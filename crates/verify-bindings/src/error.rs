use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum VerifyError {
    #[error(transparent)]
    AppAttest(#[from] zcam1_ios::Error),
}
