use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum VerifyError {
    #[cfg(feature = "apple-verify")]
    #[error(transparent)]
    AppAttest(#[from] zcam1_ios::Error),

    #[cfg(feature = "android-verify")]
    #[error(transparent)]
    AndroidAttestation(#[from] zcam1_android::Error),

    #[error("{0}")]
    Internal(String),
}
