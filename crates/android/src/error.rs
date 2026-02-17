use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Invalid certificate chain: {0}")]
    InvalidCertChain(String),

    #[error("Certificate chain does not root to Google attestation CA")]
    UntrustedRoot,

    #[error("Certificate signature verification failed: {0}")]
    CertSignatureInvalid(String),

    #[error("Key attestation extension not found (OID 1.3.6.1.4.1.11129.2.1.17)")]
    ExtensionNotFound,

    #[error("Failed to parse KeyDescription: {0}")]
    ExtensionParseError(String),

    #[error("Attestation challenge mismatch: expected {expected}, got {actual}")]
    ChallengeMismatch { expected: String, actual: String },

    #[error("{field} security level too low: got {actual:?}, required TEE or StrongBox")]
    SecurityLevelTooLow {
        field: &'static str,
        actual: SecurityLevel,
    },

    #[error("Package name mismatch: expected {expected}, got {actual}")]
    PackageNameMismatch { expected: String, actual: String },

    #[error("Signature verification failed")]
    SignatureInvalid,

    #[error("Invalid public key: {0}")]
    PublicKeyError(String),

    #[error("Base64 decode error: {0}")]
    Base64Error(#[from] base64ct::Error),

    #[error("Hex decode error: {0}")]
    HexError(#[from] hex::FromHexError),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum SecurityLevel {
    Software = 0,
    TrustedEnvironment = 1,
    StrongBox = 2,
}

impl SecurityLevel {
    #[must_use]
    pub fn from_i64(value: i64) -> Option<Self> {
        match value {
            0 => Some(Self::Software),
            1 => Some(Self::TrustedEnvironment),
            2 => Some(Self::StrongBox),
            _ => None,
        }
    }

    #[must_use]
    pub fn is_hardware_backed(self) -> bool {
        matches!(self, Self::TrustedEnvironment | Self::StrongBox)
    }
}

impl std::fmt::Display for SecurityLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Software => write!(f, "Software"),
            Self::TrustedEnvironment => write!(f, "TrustedEnvironment"),
            Self::StrongBox => write!(f, "StrongBox"),
        }
    }
}
