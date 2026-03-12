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
    /// Tag 701: Key creation time (milliseconds since epoch)
    pub creation_date_time: Option<i64>,
    /// Tag 702: Key origin (GENERATED = 0, proves key was not imported)
    pub origin: Option<i64>,
    /// Tag 704: Verified boot state from TEE
    pub root_of_trust: Option<RootOfTrust>,
    /// Tag 705: Android OS version (YYMMDD format, e.g. 130000 = Android 13)
    pub os_version: Option<i64>,
    /// Tag 706: Security patch level (YYYYMM format, e.g. 202601 = Jan 2026)
    pub os_patch_level: Option<i64>,
    /// Tag 709: Application identity
    pub attestation_application_id: Option<AttestationApplicationId>,
    /// Tag 718: Vendor-specific patch level (YYYYMMDD format)
    pub vendor_patch_level: Option<i64>,
    /// Tag 719: Boot/kernel patch level (YYYYMMDD format)
    pub boot_patch_level: Option<i64>,
}

/// Verified boot state reported by the TEE (tag 704).
///
/// ```asn1
/// RootOfTrust ::= SEQUENCE {
///     verifiedBootKey    OCTET STRING,
///     deviceLocked       BOOLEAN,
///     verifiedBootState  VerifiedBootState,
///     verifiedBootHash   OCTET STRING,
/// }
/// ```
#[derive(Debug, Clone)]
pub struct RootOfTrust {
    /// SHA-256 of the key used to verify the boot image
    pub verified_boot_key: Vec<u8>,
    /// Whether the bootloader is locked
    pub device_locked: bool,
    /// Boot chain verification state
    pub verified_boot_state: VerifiedBootState,
    /// VBMeta digest (present on attestation version >= 2)
    pub verified_boot_hash: Vec<u8>,
}

/// Boot verification state from the TEE.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum VerifiedBootState {
    /// Full chain of trust from hardware root of trust
    Verified = 0,
    /// User-configured root of trust (custom OS with locked bootloader)
    SelfSigned = 1,
    /// Unlocked bootloader, no chain of trust
    Unverified = 2,
    /// Boot verification failed
    Failed = 3,
}

impl VerifiedBootState {
    #[must_use]
    pub fn from_i64(value: i64) -> Option<Self> {
        match value {
            0 => Some(Self::Verified),
            1 => Some(Self::SelfSigned),
            2 => Some(Self::Unverified),
            3 => Some(Self::Failed),
            _ => None,
        }
    }

    /// Returns true if the boot state indicates a fully verified chain of trust.
    #[must_use]
    pub fn is_verified(self) -> bool {
        matches!(self, Self::Verified)
    }
}

impl std::fmt::Display for VerifiedBootState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Verified => write!(f, "Verified"),
            Self::SelfSigned => write!(f, "SelfSigned"),
            Self::Unverified => write!(f, "Unverified"),
            Self::Failed => write!(f, "Failed"),
        }
    }
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
