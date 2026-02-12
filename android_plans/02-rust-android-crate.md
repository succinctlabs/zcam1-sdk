# Task 02: Rust Android Verification Crate

## Overview

Create a new Rust crate `crates/android/` that validates Android Key Attestation certificate chains and ECDSA signatures. This is the Android equivalent of `crates/ios/` and will be used by the verifier to validate photos taken on Android devices.

**Estimated complexity:** Medium

**Dependencies:** None - can start immediately

**Parallel with:** 01-attestation-integration (capture side)

---

## Background Context

### What We're Validating

Android attestation consists of three artifacts that must all be verified:

1. **Key Attestation Certificate Chain** - Proves the signing key is hardware-backed
2. **Play Integrity Token** - Proves device/app integrity (optional, requires decryption keys)
3. **Photo Signature** - ECDSA signature binding the photo to the attested key

### Reference: iOS Verification (crates/ios/)

The existing iOS verification in `crates/ios/src/attestation.rs`:
1. Validates certificate chain to Apple root CA
2. Verifies nonce = SHA256(authData + SHA256(challenge))
3. Extracts public key, verifies SHA256(publicKey) == keyId
4. Verifies RP ID hash matches app ID
5. Checks counter and AAGUID

### Android Key Attestation Extension

OID: `1.3.6.1.4.1.11129.2.1.17`

ASN.1 Structure:
```asn1
KeyDescription ::= SEQUENCE {
    attestationVersion         INTEGER,
    attestationSecurityLevel   SecurityLevel,
    keyMintVersion             INTEGER,
    keyMintSecurityLevel       SecurityLevel,
    attestationChallenge       OCTET STRING,
    uniqueId                   OCTET STRING,
    softwareEnforced           AuthorizationList,
    hardwareEnforced           AuthorizationList,
}

SecurityLevel ::= ENUMERATED {
    Software            (0),
    TrustedEnvironment  (1),  -- TEE
    StrongBox           (2),  -- Dedicated secure hardware
}

AuthorizationList ::= SEQUENCE {
    purpose                     [1] EXPLICIT SET OF INTEGER OPTIONAL,
    algorithm                   [2] EXPLICIT INTEGER OPTIONAL,
    keySize                     [3] EXPLICIT INTEGER OPTIONAL,
    digest                      [5] EXPLICIT SET OF INTEGER OPTIONAL,
    ecCurve                     [10] EXPLICIT INTEGER OPTIONAL,
    origin                      [702] EXPLICIT INTEGER OPTIONAL,
    attestationApplicationId    [709] EXPLICIT OCTET STRING OPTIONAL,
    -- ... many more fields
}
```

---

## Implementation Steps

### Step 1: Create Crate Structure

```
crates/android/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── key_attestation.rs    # Certificate chain validation
│   ├── signature.rs          # ECDSA signature verification
│   ├── certificate.rs        # X.509 parsing utilities
│   ├── extension.rs          # KeyDescription ASN.1 parsing
│   ├── types.rs              # Data structures
│   ├── error.rs              # Error types
│   └── constants.rs          # Google root certs, OIDs
└── tests/
    ├── fixtures/             # Test attestation data
    └── validate_test.rs
```

### Step 2: Cargo.toml

**File:** `crates/android/Cargo.toml`

```toml
[package]
name = "zcam1-android"
version = "0.1.0"
edition = "2024"
description = "Android Key Attestation validation for ZCAM1"

[lints]
workspace = true

[dependencies]
# Serialization
base64ct = { workspace = true }
hex = { workspace = true }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }

# Error handling
thiserror = { workspace = true }
eyre = { workspace = true }

# Certificate parsing
x509-cert = "0.2"
der = "0.7"
spki = "0.7"

# ASN.1 parsing for KeyDescription extension
asn1 = "0.16"

# Cryptography
p256 = { version = "0.13", features = ["ecdsa"] }
sha2 = { version = "0.10", default-features = false }
ecdsa = { version = "0.16", features = ["verifying"] }

# Optional: Play Integrity token parsing (JWT)
josekit = { version = "0.8", optional = true }

[features]
default = []
play-integrity = ["josekit"]

[dev-dependencies]
tokio = { version = "1", features = ["rt", "macros"] }
```

### Step 3: Error Types

**File:** `crates/android/src/error.rs`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    // Certificate chain errors
    #[error("Invalid certificate chain: {0}")]
    InvalidCertChain(String),

    #[error("Certificate chain does not root to Google attestation CA")]
    UntrustedRoot,

    #[error("Certificate signature verification failed")]
    CertSignatureInvalid,

    // Key attestation extension errors
    #[error("Key attestation extension not found (OID 1.3.6.1.4.1.11129.2.1.17)")]
    ExtensionNotFound,

    #[error("Failed to parse KeyDescription: {0}")]
    ExtensionParseError(String),

    #[error("Attestation challenge mismatch: expected {expected}, got {actual}")]
    ChallengeMismatch { expected: String, actual: String },

    #[error("Security level too low: got {actual:?}, required TEE or StrongBox")]
    SecurityLevelTooLow { actual: SecurityLevel },

    #[error("Package name mismatch: expected {expected}, got {actual}")]
    PackageNameMismatch { expected: String, actual: String },

    // Signature errors
    #[error("Signature verification failed")]
    SignatureInvalid,

    #[error("Public key extraction failed: {0}")]
    PublicKeyError(String),

    // Play Integrity errors
    #[error("Play Integrity token decryption failed: {0}")]
    PlayIntegrityDecryptError(String),

    #[error("Play Integrity requestHash mismatch")]
    RequestHashMismatch,

    #[error("Device integrity verdict missing or insufficient")]
    DeviceIntegrityFailed,

    // General errors
    #[error("Base64 decode error: {0}")]
    Base64Error(#[from] base64ct::Error),

    #[error("DER parse error: {0}")]
    DerError(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityLevel {
    Software = 0,
    TrustedEnvironment = 1,
    StrongBox = 2,
}

impl SecurityLevel {
    pub fn from_i64(value: i64) -> Option<Self> {
        match value {
            0 => Some(Self::Software),
            1 => Some(Self::TrustedEnvironment),
            2 => Some(Self::StrongBox),
            _ => None,
        }
    }

    pub fn is_hardware_backed(&self) -> bool {
        matches!(self, Self::TrustedEnvironment | Self::StrongBox)
    }
}
```

### Step 4: Types

**File:** `crates/android/src/types.rs`

```rust
use serde::{Deserialize, Serialize};
use crate::error::SecurityLevel;

/// Android attestation object as received from the capture app
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AndroidAttestationObject {
    /// Base64-encoded certificate chain (format from pagopa library)
    /// Decode: base64_decode -> split by comma -> each is base64 cert
    pub key_attestation_chain: String,

    /// Play Integrity encrypted token (optional)
    pub play_integrity_token: Option<String>,
}

/// Parsed Key Attestation extension data
#[derive(Debug, Clone)]
pub struct KeyDescription {
    pub attestation_version: i64,
    pub attestation_security_level: SecurityLevel,
    pub keymint_version: i64,
    pub keymint_security_level: SecurityLevel,
    pub attestation_challenge: Vec<u8>,
    pub unique_id: Vec<u8>,
    pub software_enforced: AuthorizationList,
    pub hardware_enforced: AuthorizationList,
}

/// Authorization list from KeyDescription
#[derive(Debug, Clone, Default)]
pub struct AuthorizationList {
    pub purpose: Option<Vec<i64>>,
    pub algorithm: Option<i64>,
    pub key_size: Option<i64>,
    pub digest: Option<Vec<i64>>,
    pub ec_curve: Option<i64>,
    pub origin: Option<i64>,
    pub attestation_application_id: Option<AttestationApplicationId>,
    // Add more fields as needed
}

/// Application ID from attestation
#[derive(Debug, Clone)]
pub struct AttestationApplicationId {
    pub package_infos: Vec<PackageInfo>,
    pub signature_digests: Vec<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct PackageInfo {
    pub package_name: String,
    pub version: i64,
}

/// Result of successful key attestation validation
#[derive(Debug, Clone)]
pub struct KeyAttestationResult {
    /// Public key in uncompressed hex format (for signature verification)
    pub public_key_hex: String,

    /// SHA256 hash of public key (matches deviceKeyId)
    pub key_id_hex: String,

    /// Security level of the key
    pub security_level: SecurityLevel,

    /// Package name from attestation (if available)
    pub package_name: Option<String>,
}

/// Decrypted Play Integrity verdict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayIntegrityVerdict {
    pub request_details: RequestDetails,
    pub app_integrity: AppIntegrity,
    pub device_integrity: DeviceIntegrity,
    pub account_details: AccountDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestDetails {
    pub request_package_name: String,
    pub request_hash: Option<String>,
    pub nonce: Option<String>,
    pub timestamp_millis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIntegrity {
    pub app_recognition_verdict: String,
    pub package_name: String,
    pub certificate_sha256_digest: Vec<String>,
    pub version_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIntegrity {
    pub device_recognition_verdict: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDetails {
    pub app_licensing_verdict: String,
}
```

### Step 5: Constants (Google Root Certificates)

**File:** `crates/android/src/constants.rs`

```rust
/// Google Hardware Attestation Root CA (current)
/// Valid until: 2026
/// Download from: https://developer.android.com/privacy-and-security/security-key-attestation
pub const GOOGLE_ROOT_CA_CURRENT: &str = r#"-----BEGIN CERTIFICATE-----
MIICizCCAjKgAwIBAgIJAKIFntEOQ1tXMAoGCCqGSM49BAMCMIGiMQswCQYDVQQG
EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNTW91bnRhaW4gVmll
dzEVMBMGA1UECgwMR29vZ2xlLCBJbmMuMRAwDgYDVQQLDAdBbmRyb2lkMTswOQYD
VQQDDDJBbmRyb2lkIEtleXN0b3JlIFNvZnR3YXJlIEF0dGVzdGF0aW9uIFJvb3Qg
Q0EgLSBHMDAeFw0xNjAxMTEwMDQ2MDlaFw0yNjAxMDgwMDQ2MDlaMIGiMQswCQYD
VQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNTW91bnRhaW4g
VmlldzEVMBMGA1UECgwMR29vZ2xlLCBJbmMuMRAwDgYDVQQLDAdBbmRyb2lkMTsw
OQYDVQQDDDJBbmRyb2lkIEtleXN0b3JlIFNvZnR3YXJlIEF0dGVzdGF0aW9uIFJv
b3QgQ0EgLSBHMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABGqY1l/nL8BlGM/2
4IclS7ejVYDkjBQHULfvEkXfPfUW7UzBmjMD6zBMJwa3j0YBk6MdsbQBjvnW0hTl
c7tU1YqjYzBhMB0GA1UdDgQWBBQ//ld0vmWK0gwLo5E6RYhL8U0t5DAfBgNVHSME
GDAWgBQ//ld0vmWK0gwLo5E6RYhL8U0t5DAPBgNVHRMBAf8EBTADAQH/MA4GA1Ud
DwEB/wQEAwICBDAKBggqhkjOPQQDAgNHADBEAiBVj8Yv2bXJrHEBLYCpIBJOIFMS
0HS8PIFiJLdTbSeSSAIgMKH/dv4l4DZNN9ci40kdSK28SYKfyKiLzCTp66W4cSE=
-----END CERTIFICATE-----"#;

/// Google Hardware Attestation Root CA (new, for rotation)
/// Prepare for Feb 2026 rotation
pub const GOOGLE_ROOT_CA_NEW: &str = r#"-----BEGIN CERTIFICATE-----
... // Add when available from Google
-----END CERTIFICATE-----"#;

/// OID for Android Key Attestation Extension
pub const KEY_ATTESTATION_OID: &[u64] = &[1, 3, 6, 1, 4, 1, 11129, 2, 1, 17];

/// OID bytes for matching in certificate extensions
pub const KEY_ATTESTATION_OID_BYTES: &[u8] = &[
    0x2B, 0x06, 0x01, 0x04, 0x01, 0xD6, 0x79, 0x02, 0x01, 0x11
];
```

### Step 6: Certificate Chain Validation

**File:** `crates/android/src/certificate.rs`

```rust
use base64ct::{Base64, Encoding};
use x509_cert::Certificate;
use x509_cert::der::{Decode, DecodePem};

use crate::constants::{GOOGLE_ROOT_CA_CURRENT, GOOGLE_ROOT_CA_NEW};
use crate::error::Error;

/// Decode the attestation string from pagopa format
/// Format: base64(base64(cert1) + "," + base64(cert2) + ...)
pub fn decode_certificate_chain(attestation: &str) -> Result<Vec<Certificate>, Error> {
    // First base64 decode
    let outer_decoded = Base64::decode_vec(attestation)
        .map_err(|e| Error::InvalidCertChain(format!("Outer base64 decode failed: {}", e)))?;

    let inner_string = String::from_utf8(outer_decoded)
        .map_err(|e| Error::InvalidCertChain(format!("UTF-8 decode failed: {}", e)))?;

    // Split by comma and decode each certificate
    let cert_strings: Vec<&str> = inner_string.split(',').collect();
    let mut certificates = Vec::with_capacity(cert_strings.len());

    for (i, cert_b64) in cert_strings.iter().enumerate() {
        let cert_der = Base64::decode_vec(cert_b64.trim())
            .map_err(|e| Error::InvalidCertChain(format!("Cert {} base64 decode failed: {}", i, e)))?;

        let cert = Certificate::from_der(&cert_der)
            .map_err(|e| Error::InvalidCertChain(format!("Cert {} DER parse failed: {}", i, e)))?;

        certificates.push(cert);
    }

    if certificates.is_empty() {
        return Err(Error::InvalidCertChain("Empty certificate chain".to_string()));
    }

    Ok(certificates)
}

/// Validate certificate chain roots to Google attestation CA
pub fn validate_certificate_chain(certificates: &[Certificate]) -> Result<(), Error> {
    if certificates.is_empty() {
        return Err(Error::InvalidCertChain("Empty chain".to_string()));
    }

    // Parse Google root certificates
    let google_root_current = Certificate::from_pem(GOOGLE_ROOT_CA_CURRENT.as_bytes())
        .map_err(|e| Error::InvalidCertChain(format!("Failed to parse Google root CA: {}", e)))?;

    // Get the root (last) certificate from the chain
    let chain_root = certificates.last().unwrap();

    // Check if chain root matches Google root (by subject)
    let google_subject = &google_root_current.tbs_certificate.subject;
    let chain_root_subject = &chain_root.tbs_certificate.subject;

    if google_subject != chain_root_subject {
        return Err(Error::UntrustedRoot);
    }

    // Verify each certificate in the chain is signed by the next
    for i in 0..certificates.len() - 1 {
        let cert = &certificates[i];
        let issuer = &certificates[i + 1];

        // Verify cert's issuer matches issuer's subject
        if cert.tbs_certificate.issuer != issuer.tbs_certificate.subject {
            return Err(Error::InvalidCertChain(format!(
                "Certificate {} issuer doesn't match certificate {} subject",
                i, i + 1
            )));
        }

        // TODO: Verify signature (requires extracting public key and verifying)
        // For now, we trust the chain structure
    }

    Ok(())
}

/// Extract the leaf certificate (first in chain)
pub fn get_leaf_certificate(certificates: &[Certificate]) -> Result<&Certificate, Error> {
    certificates.first().ok_or(Error::InvalidCertChain("Empty chain".to_string()))
}
```

### Step 7: KeyDescription Extension Parsing

**File:** `crates/android/src/extension.rs`

```rust
use asn1::{ParseError, SequenceOf, SimpleAsn1Readable};
use x509_cert::Certificate;
use x509_cert::der::Decode;

use crate::constants::KEY_ATTESTATION_OID_BYTES;
use crate::error::{Error, SecurityLevel};
use crate::types::{AuthorizationList, KeyDescription, AttestationApplicationId, PackageInfo};

/// Extract and parse the Key Attestation extension from a certificate
pub fn parse_key_description(cert: &Certificate) -> Result<KeyDescription, Error> {
    // Find the extension with our OID
    let extensions = cert.tbs_certificate.extensions.as_ref()
        .ok_or(Error::ExtensionNotFound)?;

    let mut extension_value: Option<&[u8]> = None;

    for ext in extensions.iter() {
        let oid_bytes = ext.extn_id.as_bytes();
        if oid_bytes == KEY_ATTESTATION_OID_BYTES {
            extension_value = Some(ext.extn_value.as_bytes());
            break;
        }
    }

    let ext_bytes = extension_value.ok_or(Error::ExtensionNotFound)?;

    // Parse the ASN.1 KeyDescription structure
    parse_key_description_asn1(ext_bytes)
}

fn parse_key_description_asn1(bytes: &[u8]) -> Result<KeyDescription, Error> {
    // The KeyDescription is a SEQUENCE
    // This is a simplified parser - production code should use a proper ASN.1 library

    let parsed = asn1::parse_single::<KeyDescriptionAsn1>(bytes)
        .map_err(|e| Error::ExtensionParseError(format!("{:?}", e)))?;

    let attestation_security_level = SecurityLevel::from_i64(parsed.attestation_security_level)
        .ok_or(Error::ExtensionParseError("Invalid security level".to_string()))?;

    let keymint_security_level = SecurityLevel::from_i64(parsed.keymint_security_level)
        .ok_or(Error::ExtensionParseError("Invalid keymint security level".to_string()))?;

    Ok(KeyDescription {
        attestation_version: parsed.attestation_version,
        attestation_security_level,
        keymint_version: parsed.keymint_version,
        keymint_security_level,
        attestation_challenge: parsed.attestation_challenge.to_vec(),
        unique_id: parsed.unique_id.to_vec(),
        software_enforced: parse_authorization_list(&parsed.software_enforced)?,
        hardware_enforced: parse_authorization_list(&parsed.hardware_enforced)?,
    })
}

// ASN.1 structure for parsing
#[derive(asn1::Asn1Read)]
struct KeyDescriptionAsn1<'a> {
    attestation_version: i64,
    attestation_security_level: i64,
    keymint_version: i64,
    keymint_security_level: i64,
    attestation_challenge: &'a [u8],
    unique_id: &'a [u8],
    software_enforced: asn1::Sequence<'a>,
    hardware_enforced: asn1::Sequence<'a>,
}

fn parse_authorization_list(seq: &asn1::Sequence) -> Result<AuthorizationList, Error> {
    // Parse the SEQUENCE of tagged values
    // This is complex due to the many optional fields
    // Simplified implementation - extract key fields

    let mut auth_list = AuthorizationList::default();

    // TODO: Implement full parsing of AuthorizationList
    // For now, we focus on attestationApplicationId (tag 709)

    // Parse sequence contents and look for tagged values
    // Tag 709 = attestationApplicationId

    Ok(auth_list)
}

/// Extract package name from AuthorizationList if present
pub fn extract_package_name(key_desc: &KeyDescription) -> Option<String> {
    key_desc.software_enforced.attestation_application_id
        .as_ref()
        .and_then(|app_id| app_id.package_infos.first())
        .map(|pkg| pkg.package_name.clone())
}
```

### Step 8: Main Validation Logic

**File:** `crates/android/src/key_attestation.rs`

```rust
use base64ct::{Base64, Encoding};
use sha2::{Digest, Sha256};

use crate::certificate::{decode_certificate_chain, validate_certificate_chain, get_leaf_certificate};
use crate::extension::{parse_key_description, extract_package_name};
use crate::error::{Error, SecurityLevel};
use crate::types::KeyAttestationResult;

/// Validate Android Key Attestation and return the public key for signature verification
///
/// # Arguments
/// * `attestation` - Base64-encoded attestation from pagopa library
/// * `expected_challenge` - The challenge that should be in the certificate (usually deviceKeyId)
/// * `expected_package_name` - Expected app package name (e.g., "com.anonymous.zcam1")
/// * `production` - If true, require TEE/StrongBox; if false, allow Software for testing
///
/// # Returns
/// * `KeyAttestationResult` containing the public key and validation details
pub fn validate_key_attestation(
    attestation: &str,
    expected_challenge: &str,
    expected_package_name: &str,
    production: bool,
) -> Result<KeyAttestationResult, Error> {
    // 1. Decode certificate chain
    let certificates = decode_certificate_chain(attestation)?;

    // 2. Validate chain roots to Google CA
    validate_certificate_chain(&certificates)?;

    // 3. Get leaf certificate (contains KeyDescription)
    let leaf_cert = get_leaf_certificate(&certificates)?;

    // 4. Parse KeyDescription extension
    let key_desc = parse_key_description(leaf_cert)?;

    // 5. Verify attestation challenge matches
    let challenge_bytes = expected_challenge.as_bytes();
    if key_desc.attestation_challenge != challenge_bytes {
        return Err(Error::ChallengeMismatch {
            expected: expected_challenge.to_string(),
            actual: String::from_utf8_lossy(&key_desc.attestation_challenge).to_string(),
        });
    }

    // 6. Verify security level
    if production && !key_desc.attestation_security_level.is_hardware_backed() {
        return Err(Error::SecurityLevelTooLow {
            actual: key_desc.attestation_security_level,
        });
    }

    // 7. Verify package name (if available in attestation)
    if let Some(actual_package) = extract_package_name(&key_desc) {
        if actual_package != expected_package_name {
            return Err(Error::PackageNameMismatch {
                expected: expected_package_name.to_string(),
                actual: actual_package,
            });
        }
    }

    // 8. Extract public key from leaf certificate
    let public_key_info = &leaf_cert.tbs_certificate.subject_public_key_info;
    let public_key_bytes = public_key_info.subject_public_key.raw_bytes();
    let public_key_hex = hex::encode(public_key_bytes);

    // 9. Compute key ID (SHA256 of public key)
    let key_id = Sha256::digest(public_key_bytes);
    let key_id_hex = hex::encode(key_id);

    Ok(KeyAttestationResult {
        public_key_hex,
        key_id_hex,
        security_level: key_desc.attestation_security_level,
        package_name: extract_package_name(&key_desc),
    })
}
```

### Step 9: Signature Verification

**File:** `crates/android/src/signature.rs`

```rust
use base64ct::{Base64, Encoding};
use ecdsa::signature::Verifier;
use p256::ecdsa::{Signature, VerifyingKey};
use p256::PublicKey;
use sha2::{Digest, Sha256};

use crate::error::Error;

/// Verify an ECDSA signature from Android Keystore
///
/// # Arguments
/// * `signature_b64` - Base64-encoded DER signature from signWithHardwareKey()
/// * `message` - The message that was signed (e.g., "base64(photoHash)|base64(metadataHash)")
/// * `public_key_hex` - Public key in hex format from KeyAttestationResult
///
/// # Returns
/// * `Ok(true)` if signature is valid
pub fn verify_signature(
    signature_b64: &str,
    message: &str,
    public_key_hex: &str,
) -> Result<bool, Error> {
    // Decode signature
    let signature_bytes = Base64::decode_vec(signature_b64)
        .map_err(|e| Error::SignatureInvalid)?;

    // Parse DER-encoded signature
    let signature = Signature::from_der(&signature_bytes)
        .map_err(|_| Error::SignatureInvalid)?;

    // Decode public key
    let public_key_bytes = hex::decode(public_key_hex)
        .map_err(|e| Error::PublicKeyError(format!("Hex decode failed: {}", e)))?;

    let public_key = PublicKey::from_sec1_bytes(&public_key_bytes)
        .map_err(|e| Error::PublicKeyError(format!("Invalid public key: {}", e)))?;

    let verifying_key = VerifyingKey::from(&public_key);

    // Hash the message (Android signs SHA256 hash)
    let message_hash = Sha256::digest(message.as_bytes());

    // Verify signature
    verifying_key
        .verify(&message_hash, &signature)
        .map(|_| true)
        .map_err(|_| Error::SignatureInvalid)
}

/// Verify that photo hash and metadata match the signed message
pub fn verify_message_binding(
    photo_hash: &[u8],
    metadata: &str,
    signed_message: &str,
) -> Result<bool, Error> {
    // Reconstruct expected message: base64(photoHash) | base64(sha256(metadata))
    let photo_hash_b64 = Base64::encode_string(photo_hash);
    let metadata_hash = Sha256::digest(metadata.as_bytes());
    let metadata_hash_b64 = Base64::encode_string(&metadata_hash);

    let expected_message = format!("{}|{}", photo_hash_b64, metadata_hash_b64);

    Ok(signed_message == expected_message)
}
```

### Step 10: Library Entry Point

**File:** `crates/android/src/lib.rs`

```rust
//! Android Key Attestation validation for ZCAM1
//!
//! This crate validates Android device attestation artifacts:
//! - Key Attestation certificate chains (proves hardware-backed key)
//! - ECDSA signatures (proves photo was signed by attested key)
//! - Play Integrity tokens (proves device/app integrity) [optional]

pub mod certificate;
pub mod constants;
pub mod error;
pub mod extension;
pub mod key_attestation;
pub mod signature;
pub mod types;

#[cfg(feature = "play-integrity")]
pub mod play_integrity;

pub use error::{Error, SecurityLevel};
pub use key_attestation::validate_key_attestation;
pub use signature::{verify_signature, verify_message_binding};
pub use types::*;

/// Convenience function to validate all Android attestation artifacts
pub fn validate_android_attestation(
    attestation: &str,
    signature: &str,
    message: &str,
    expected_challenge: &str,
    expected_package_name: &str,
    production: bool,
) -> Result<bool, Error> {
    // 1. Validate Key Attestation and get public key
    let key_result = validate_key_attestation(
        attestation,
        expected_challenge,
        expected_package_name,
        production,
    )?;

    // 2. Verify signature with the attested public key
    verify_signature(signature, message, &key_result.public_key_hex)?;

    Ok(true)
}
```

### Step 11: Add to Workspace

**File:** `Cargo.toml` (workspace root)

Add to members:
```toml
[workspace]
members = [
    # ... existing members
    "crates/android",
]

[workspace.dependencies]
# ... existing deps
zcam1-android = { path = "./crates/android" }
```

---

## Files Summary

| File | Purpose |
|------|---------|
| `crates/android/Cargo.toml` | Crate configuration and dependencies |
| `crates/android/src/lib.rs` | Public API exports |
| `crates/android/src/error.rs` | Error types and SecurityLevel enum |
| `crates/android/src/types.rs` | Data structures |
| `crates/android/src/constants.rs` | Google root certs, OIDs |
| `crates/android/src/certificate.rs` | Certificate chain parsing and validation |
| `crates/android/src/extension.rs` | KeyDescription ASN.1 parsing |
| `crates/android/src/key_attestation.rs` | Main validation logic |
| `crates/android/src/signature.rs` | ECDSA signature verification |

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Test with real attestation captured from a device
    const TEST_ATTESTATION: &str = include_str!("../tests/fixtures/real_attestation.txt");
    const TEST_CHALLENGE: &str = "zcam1_test_device_key";
    const TEST_PACKAGE: &str = "com.anonymous.zcam1";

    #[test]
    fn test_decode_certificate_chain() {
        let certs = decode_certificate_chain(TEST_ATTESTATION).unwrap();
        assert!(certs.len() >= 2); // At least leaf + root
    }

    #[test]
    fn test_validate_key_attestation() {
        let result = validate_key_attestation(
            TEST_ATTESTATION,
            TEST_CHALLENGE,
            TEST_PACKAGE,
            false, // Allow software keys for testing
        ).unwrap();

        assert!(!result.public_key_hex.is_empty());
        assert!(!result.key_id_hex.is_empty());
    }

    #[test]
    fn test_signature_verification() {
        // Use test vectors
        let signature = "MEUCIQDh..."; // Base64 DER signature
        let message = "base64hash|base64hash";
        let public_key = "04..."; // Uncompressed EC point

        let result = verify_signature(signature, message, public_key);
        assert!(result.is_ok());
    }
}
```

### Integration Test

Capture real attestation from an Android device and save to `tests/fixtures/`.

---

## Deliverables

### Files to Create

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Crate manifest | `crates/android/Cargo.toml` | Create |
| Library entry point | `crates/android/src/lib.rs` | Create |
| Error types | `crates/android/src/error.rs` | Create |
| Type definitions | `crates/android/src/types.rs` | Create |
| Constants (root certs) | `crates/android/src/constants.rs` | Create |
| Certificate parsing | `crates/android/src/certificate.rs` | Create |
| Extension parsing | `crates/android/src/extension.rs` | Create |
| Key attestation logic | `crates/android/src/key_attestation.rs` | Create |
| Signature verification | `crates/android/src/signature.rs` | Create |
| Unit tests | `crates/android/src/tests/*.rs` | Create |
| Test fixtures | `crates/android/tests/fixtures/*.txt` | Create |
| Workspace update | `crates/Cargo.toml` | Modify |

---

## Interface Definitions

### Public API

```rust
// lib.rs - Public exports
pub use error::{Error, SecurityLevel};
pub use key_attestation::validate_key_attestation;
pub use signature::{verify_signature, verify_message_binding};
pub use types::*;
```

### Core Functions

```rust
/// Validate Android Key Attestation and return the public key for signature verification
///
/// # Arguments
/// * `attestation` - Base64-encoded attestation from pagopa library
/// * `expected_challenge` - The challenge that should be in the certificate (deviceKeyId)
/// * `expected_package_name` - Expected app package name (e.g., "com.anonymous.zcam1")
/// * `production` - If true, require TEE/StrongBox; if false, allow Software for testing
///
/// # Returns
/// * `KeyAttestationResult` containing the public key and validation details
pub fn validate_key_attestation(
    attestation: &str,
    expected_challenge: &str,
    expected_package_name: &str,
    production: bool,
) -> Result<KeyAttestationResult, Error>;

/// Verify an ECDSA signature from Android Keystore
///
/// # Arguments
/// * `signature_b64` - Base64-encoded DER signature from signWithHardwareKey()
/// * `message` - The message that was signed
/// * `public_key_hex` - Public key in hex format from KeyAttestationResult
///
/// # Returns
/// * `Ok(true)` if signature is valid
pub fn verify_signature(
    signature_b64: &str,
    message: &str,
    public_key_hex: &str,
) -> Result<bool, Error>;

/// Verify that photo hash and metadata match the signed message
pub fn verify_message_binding(
    photo_hash: &[u8],
    metadata: &str,
    signed_message: &str,
) -> Result<bool, Error>;

/// Convenience function to validate all Android attestation artifacts
pub fn validate_android_attestation(
    attestation: &str,
    signature: &str,
    message: &str,
    expected_challenge: &str,
    expected_package_name: &str,
    production: bool,
) -> Result<bool, Error>;
```

### Data Structures

```rust
/// Result of successful key attestation validation
pub struct KeyAttestationResult {
    /// Public key in uncompressed hex format (for signature verification)
    pub public_key_hex: String,
    /// SHA256 hash of public key (matches deviceKeyId)
    pub key_id_hex: String,
    /// Security level of the key
    pub security_level: SecurityLevel,
    /// Package name from attestation (if available)
    pub package_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityLevel {
    Software = 0,
    TrustedEnvironment = 1,  // TEE
    StrongBox = 2,           // Dedicated secure hardware
}

/// Parsed Key Attestation extension data
pub struct KeyDescription {
    pub attestation_version: i64,
    pub attestation_security_level: SecurityLevel,
    pub keymint_version: i64,
    pub keymint_security_level: SecurityLevel,
    pub attestation_challenge: Vec<u8>,
    pub unique_id: Vec<u8>,
    pub software_enforced: AuthorizationList,
    pub hardware_enforced: AuthorizationList,
}
```

### Error Types

```rust
#[derive(Debug, Error)]
pub enum Error {
    #[error("Invalid certificate chain: {0}")]
    InvalidCertChain(String),

    #[error("Certificate chain does not root to Google attestation CA")]
    UntrustedRoot,

    #[error("Key attestation extension not found")]
    ExtensionNotFound,

    #[error("Attestation challenge mismatch")]
    ChallengeMismatch { expected: String, actual: String },

    #[error("Security level too low")]
    SecurityLevelTooLow { actual: SecurityLevel },

    #[error("Package name mismatch")]
    PackageNameMismatch { expected: String, actual: String },

    #[error("Signature verification failed")]
    SignatureInvalid,
    // ...
}
```

---

## Testing Plan

### Unit Tests

| Test | File | Purpose |
|------|------|---------|
| `test_decode_certificate_chain` | `certificate.rs` | Verify pagopa format decoding |
| `test_decode_invalid_base64` | `certificate.rs` | Error handling for bad input |
| `test_decode_empty_chain` | `certificate.rs` | Error handling for empty chain |
| `test_validate_chain_to_google_root` | `certificate.rs` | Chain validation |
| `test_reject_untrusted_root` | `certificate.rs` | Reject non-Google chains |
| `test_parse_key_description` | `extension.rs` | ASN.1 parsing |
| `test_extract_challenge` | `extension.rs` | Challenge extraction |
| `test_extract_security_level` | `extension.rs` | Security level parsing |
| `test_extract_package_name` | `extension.rs` | Package name extraction |
| `test_validate_attestation_strongbox` | `key_attestation.rs` | StrongBox validation |
| `test_validate_attestation_tee` | `key_attestation.rs` | TEE validation |
| `test_validate_attestation_software` | `key_attestation.rs` | Software key handling |
| `test_reject_wrong_challenge` | `key_attestation.rs` | Challenge mismatch |
| `test_reject_wrong_package` | `key_attestation.rs` | Package mismatch |
| `test_reject_software_in_production` | `key_attestation.rs` | Production mode enforcement |
| `test_verify_valid_signature` | `signature.rs` | ECDSA verification |
| `test_reject_invalid_signature` | `signature.rs` | Invalid signature |
| `test_reject_wrong_public_key` | `signature.rs` | Key mismatch |
| `test_verify_message_binding` | `signature.rs` | Message format validation |

### Test Fixtures Required

| Fixture | Device/Source | Purpose |
|---------|---------------|---------|
| `pixel6_strongbox.txt` | Pixel 6 Pro | StrongBox attestation chain |
| `pixel4_tee.txt` | Pixel 4 | TEE attestation chain |
| `samsung_tee.txt` | Samsung Galaxy S21 | OEM TEE attestation |
| `emulator_software.txt` | Android Emulator | Software key attestation |
| `invalid_chain.txt` | Generated | Invalid/tampered chain |
| `wrong_root.txt` | Generated | Chain with wrong root CA |
| `test_signature.txt` | Generated | Valid signature for testing |
| `test_public_key.txt` | Generated | Matching public key |

### Fixture Capture Script

```kotlin
// Android app code to capture attestation for test fixtures
class AttestationFixtureCapture {
    fun captureFixture(challenge: String): String {
        val alias = "test_fixture_${System.currentTimeMillis()}"

        // Generate attested key
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
        )
        keyPairGenerator.initialize(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAttestationChallenge(challenge.toByteArray())
                .build()
        )
        keyPairGenerator.generateKeyPair()

        // Get certificate chain
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        val chain = keyStore.getCertificateChain(alias)

        // Format as pagopa does
        val chainB64 = chain.joinToString(",") {
            Base64.encodeToString(it.encoded, Base64.NO_WRAP)
        }
        return Base64.encodeToString(chainB64.toByteArray(), Base64.NO_WRAP)
    }
}
```

### Integration Tests

```rust
#[test]
fn test_full_validation_flow() {
    // Load real attestation fixture
    let attestation = include_str!("fixtures/pixel6_strongbox.txt");
    let challenge = "test_device_key_123";
    let package = "com.anonymous.zcam1";

    // Step 1: Validate attestation
    let result = validate_key_attestation(attestation, challenge, package, true);
    assert!(result.is_ok());
    let key_result = result.unwrap();

    // Step 2: Verify security level
    assert_eq!(key_result.security_level, SecurityLevel::StrongBox);

    // Step 3: Verify signature with extracted public key
    let signature = include_str!("fixtures/test_signature.txt");
    let message = "base64hash|base64hash";
    let sig_result = verify_signature(signature, message, &key_result.public_key_hex);
    assert!(sig_result.is_ok());
}

#[test]
fn test_cross_device_validation() {
    // Test fixtures from different device manufacturers
    let fixtures = [
        ("pixel6_strongbox.txt", SecurityLevel::StrongBox),
        ("pixel4_tee.txt", SecurityLevel::TrustedEnvironment),
        ("samsung_tee.txt", SecurityLevel::TrustedEnvironment),
    ];

    for (fixture, expected_level) in fixtures {
        let attestation = include_str!(concat!("fixtures/", fixture));
        let result = validate_key_attestation(attestation, "challenge", "com.test", false);
        assert!(result.is_ok(), "Failed for {}", fixture);
        assert_eq!(result.unwrap().security_level, expected_level);
    }
}
```

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **Crate compiles without errors**
  - All files created and compile
  - No clippy warnings in default config
  - `cargo build` succeeds

- [ ] **Certificate chain parsing works**
  - `decode_certificate_chain()` parses pagopa format
  - Returns `Vec<Certificate>` with correct count
  - Handles at least 3 certificates (leaf + intermediate + root)

- [ ] **Certificate chain validation works**
  - `validate_certificate_chain()` verifies chain structure
  - Correctly identifies Google attestation root CA
  - Rejects chains not rooting to Google

- [ ] **KeyDescription parsing works**
  - `parse_key_description()` extracts ASN.1 extension
  - Extracts `attestationChallenge` correctly
  - Extracts `attestationSecurityLevel` correctly
  - Parses at least these fields: version, challenge, security level

- [ ] **Key attestation validation works**
  - `validate_key_attestation()` performs full validation
  - Returns `KeyAttestationResult` with public key
  - Enforces challenge match
  - Enforces security level in production mode
  - Package name validation (when available)

- [ ] **Signature verification works**
  - `verify_signature()` validates ECDSA signatures
  - Handles DER-encoded signatures from Android
  - Works with P-256 (secp256r1) curve
  - Returns correct result for valid/invalid signatures

- [ ] **All unit tests pass**
  - Minimum 20 unit tests
  - Tests cover all error cases
  - Tests use real device fixtures

- [ ] **Integration test passes**
  - Full flow: parse → validate → verify signature
  - Uses at least one real device fixture

### Should Have (Expected but not blocking)

- [ ] **Test fixtures from multiple devices**
  - StrongBox device (Pixel 6+)
  - TEE device (older Pixel or Samsung)
  - Emulator (software keys)

- [ ] **Documentation**
  - All public functions have doc comments
  - README.md with usage examples
  - Error handling guidance

- [ ] **Code coverage > 80%**
  - Run with `cargo tarpaulin`

### Nice to Have (Not required)

- [ ] **Play Integrity token parsing** (feature-gated)
- [ ] **Performance benchmarks**
- [ ] **Fuzzing tests for ASN.1 parsing**

---

## Verification Commands

```bash
# Build the crate
cd crates/android
cargo build

# Run tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Check for warnings
cargo clippy

# Generate documentation
cargo doc --open

# Run with coverage
cargo tarpaulin --out Html

# Verify it works from workspace
cd ../..
cargo test -p zcam1-android
```

---

## Handoff to Next Tasks

### Output for Task 04 (Verify Updates)

This crate provides these exports for Task 04 to import:

```rust
// In verify-utils/Cargo.toml
[dependencies]
zcam1-android = { path = "../android" }

// In verify-utils/src/lib.rs
use zcam1_android::{
    validate_key_attestation,
    verify_signature,
    KeyAttestationResult,
    SecurityLevel,
    Error as AndroidError,
};
```

### Data Format Documentation

**Input format (from Task 01):**
```
Key Attestation Chain:
  base64(base64(cert1) + "," + base64(cert2) + "," + base64(cert3))

Signature:
  base64(DER-encoded ECDSA signature)
  DER format: SEQUENCE { INTEGER r, INTEGER s }

Message:
  base64(photoHash) + "|" + base64(sha256(metadata))
```

**Output format:**
```rust
KeyAttestationResult {
    public_key_hex: "04abc123...",  // Uncompressed EC point
    key_id_hex: "sha256ofpubkey...",
    security_level: SecurityLevel::StrongBox,
    package_name: Some("com.anonymous.zcam1"),
}
```

---

## Next Steps

After this task is complete:
- Task 04 (verify-updates) will integrate this crate into the verification bindings
- The verifier will be able to validate both iOS and Android attestations
