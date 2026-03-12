use std::io;

use thiserror::Error;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum VerifyError {
    #[error(transparent)]
    C2pa(#[from] zcam1_c2pa_utils::error::C2paError),

    #[cfg(feature = "apple-verify")]
    #[error(transparent)]
    AppAttest(#[from] zcam1_ios::Error),

    #[cfg(feature = "android-verify")]
    #[error(transparent)]
    AndroidAttestation(#[from] zcam1_android::Error),

    #[error(transparent)]
    Base64(#[from] base64ct::Error),

    #[error(transparent)]
    Io(#[from] io::Error),

    #[error(transparent)]
    Groth16(#[from] sp1_verifier::Groth16Error),

    #[error("Proof not found in the manifest")]
    ProofNotFound,
}
