use thiserror::Error;
use x509_cert::spki;

#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum Error {
    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    RcGen(#[from] rcgen::Error),

    #[error(transparent)]
    Der(#[from] der::Error),

    #[error(transparent)]
    Spki(#[from] spki::Error),

    #[error(transparent)]
    Pkcs8(#[from] p256::pkcs8::Error),

    #[error(transparent)]
    EllipticCurve(#[from] p256::elliptic_curve::Error),

    #[error(transparent)]
    X509Cert(#[from] x509_cert::builder::Error),
}
