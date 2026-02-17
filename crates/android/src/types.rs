use crate::error::SecurityLevel;

/// Parsed Key Attestation extension data (OID 1.3.6.1.4.1.11129.2.1.17)
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

/// Authorization list from `KeyDescription`.
///
/// Contains optional tagged fields from the ASN.1 structure.
/// Only fields we need for validation are parsed; others are skipped.
#[derive(Debug, Clone, Default)]
pub struct AuthorizationList {
    /// Tag 1: Key purpose (e.g., SIGN)
    pub purpose: Option<Vec<i64>>,
    /// Tag 2: Algorithm (e.g., EC)
    pub algorithm: Option<i64>,
    /// Tag 3: Key size (e.g., 256)
    pub key_size: Option<i64>,
    /// Tag 5: Digest algorithms
    pub digest: Option<Vec<i64>>,
    /// Tag 10: EC curve (e.g., P-256)
    pub ec_curve: Option<i64>,
    /// Tag 702: Key origin (GENERATED = 0, proves key was not imported)
    pub origin: Option<i64>,
    /// Tag 709: Application identity
    pub attestation_application_id: Option<AttestationApplicationId>,
}

/// Application identity from attestation (tag 709 content)
#[derive(Debug, Clone)]
pub struct AttestationApplicationId {
    pub package_infos: Vec<PackageInfo>,
    pub signature_digests: Vec<Vec<u8>>,
}

/// Package info within `AttestationApplicationId`
#[derive(Debug, Clone)]
pub struct PackageInfo {
    pub package_name: String,
    pub version: i64,
}

/// Result of successful key attestation validation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KeyAttestationResult {
    /// Public key in uncompressed hex format (for signature verification)
    pub public_key_hex: String,
    /// SHA-256 hash of public key bytes, hex-encoded
    pub key_id_hex: String,
    /// Security level of the attested key
    pub security_level: SecurityLevel,
    /// Package name from attestation (if available)
    pub package_name: Option<String>,
}
