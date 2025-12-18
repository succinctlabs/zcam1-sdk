use p256::ecdsa;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Failed to decode data from base64: {0}")]
    DecodeAuthDataFailed(#[from] base64ct::Error),

    #[error("Failed verify signature: {0}")]
    FailedToVerifySignature(#[from] ecdsa::signature::Error),

    #[error("Invalid certificate chain")]
    InvalidCertChain,

    #[error("Credential public key not found in certificate")]
    CredentialPublicKeyNotFound,

    #[error("Failed to parse DER: {0}")]
    FailedToParseDer(#[from] der_parser::asn1_rs::Err<der_parser::error::Error>),

    #[error("Nonce mismatch")]
    NonceMismatch,

    #[error("Expected OctetString content in extension")]
    OctetStringExpected,

    #[error("Expected Unknown content in extension")]
    UnknownContentExpected,

    #[error("RP ID mismatch: device RP ID does not match expected value")]
    RpIdMismatch,

    #[error("Invalid app ID format")]
    InvalidAppId,

    #[error("Public key hash mismatch")]
    PublicKeyHashMismatch,

    #[error("Counter must be 0 for attestation")]
    InvalidCounter,

    #[error("AAGUID must be 16 bytes")]
    InvalidAaguidLength,

    #[error("AAGUID mismatch")]
    AaguidMismatch,

    #[error("AAGUID not found")]
    AaguidNotFound,
}
