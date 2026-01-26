//! # Network Signer
//!
//! This module provides a unified signer that supports both local private keys and AWS KMS.

use alloy_primitives::Address;
use alloy_signer::{Signature, Signer, SignerSync};
use alloy_signer_local::{LocalSignerError, PrivateKeySigner};

/// Errors that can occur when using the network signer.
#[derive(Debug, thiserror::Error)]
pub enum NetworkSignerError {
    /// An error occurred while using the local signer.
    #[error("Local signer error: {0}")]
    Local(#[from] LocalSignerError),

    /// An error occurred while parsing the private key.
    #[error("Parse error: {0}")]
    Parse(String),

    /// An error occurred while signing the message.
    #[error("Signing error: {0}")]
    Signing(#[from] alloy_signer::Error),

    /// An error occurred while parsing the KMS ARN.
    #[error("Invalid KMS ARN format: {0}")]
    InvalidKmsArn(String),
}

/// Unified signer that supports both local private keys and AWS KMS.
#[derive(Clone, Debug)]
pub enum NetworkSigner {
    /// Local private key signer.
    Local(PrivateKeySigner),
}

impl NetworkSigner {
    /// Create a local signer from a private key string.
    pub fn local(private_key: &str) -> Result<Self, NetworkSignerError> {
        let signer = private_key
            .parse::<PrivateKeySigner>()
            .map_err(|e| NetworkSignerError::Parse(e.to_string()))?;
        Ok(NetworkSigner::Local(signer))
    }

    /// Get the address of the signer.
    #[must_use]
    pub fn address(&self) -> Address {
        match self {
            NetworkSigner::Local(signer) => Signer::address(signer),
        }
    }

    /// Sign an arbitrary message per EIP-191.
    pub async fn sign_message(&self, message: &[u8]) -> Result<Signature, NetworkSignerError> {
        match self {
            NetworkSigner::Local(signer) => signer
                .sign_message_sync(message)
                .map_err(NetworkSignerError::Signing),
        }
    }
}

impl From<String> for NetworkSigner {
    fn from(private_key: String) -> Self {
        NetworkSigner::local(&private_key).expect("Failed to parse private key")
    }
}

impl From<&str> for NetworkSigner {
    fn from(private_key: &str) -> Self {
        NetworkSigner::local(private_key).expect("Failed to parse private key")
    }
}

/// Extract AWS region from a KMS ARN-formatted string.
fn extract_region_from_kms_arn(arn: &str) -> Result<String, NetworkSignerError> {
    let parts: Vec<&str> = arn.split(':').collect();
    if parts.len() < 6 || parts[0] != "arn" || parts[1] != "aws" || parts[2] != "kms" {
        return Err(NetworkSignerError::InvalidKmsArn(format!(
            "Expected format: arn:aws:kms:REGION:account:key/key-id, got: {arn}"
        )));
    }
    Ok(parts[3].to_string())
}
