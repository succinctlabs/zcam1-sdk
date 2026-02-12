use std::sync::LazyLock;

use base64ct::{Base64, Encoding};
use x509_cert::Certificate;
use x509_verify::{VerifyingKey, der::{Decode, DecodePem}};

use crate::constants::{GOOGLE_HARDWARE_ROOT_EC, GOOGLE_HARDWARE_ROOT_RSA, GOOGLE_SOFTWARE_ROOT};
use crate::error::Error;

/// Pre-parsed Google root CA certificates, parsed once at first access.
///
/// The software root is optional because it expired Jan 2026 and its DER
/// encoding uses SEQUENCE where strict parsers expect SET, causing
/// `x509-cert` 0.2 to reject it.
struct GoogleRoots {
    hardware_rsa: Certificate,
    hardware_ec: Certificate,
    software: Option<Certificate>,
}

static GOOGLE_ROOTS: LazyLock<Option<GoogleRoots>> = LazyLock::new(|| {
    let hardware_rsa = Certificate::from_pem(GOOGLE_HARDWARE_ROOT_RSA).ok()?;
    let hardware_ec = Certificate::from_pem(GOOGLE_HARDWARE_ROOT_EC).ok()?;
    // Software root may fail to parse (non-conformant DER). That's OK —
    // it's only used for emulator testing and has already expired.
    let software = Certificate::from_pem(GOOGLE_SOFTWARE_ROOT).ok();
    Some(GoogleRoots {
        hardware_rsa,
        hardware_ec,
        software,
    })
});

/// Decode the attestation string from pagopa format.
///
/// Format: `base64(base64(cert1) + "," + base64(cert2) + ...)`
/// - Outer base64 decode -> UTF-8 string
/// - Split by comma -> each element is base64-encoded DER certificate
/// - certs\[0\] = leaf (contains `KeyDescription` extension)
/// - certs\[n-1\] = root (should chain to Google attestation CA)
pub fn decode_certificate_chain(attestation: &str) -> Result<Vec<Certificate>, Error> {
    let outer_decoded = Base64::decode_vec(attestation)
        .map_err(|e| Error::InvalidCertChain(format!("outer base64 decode failed: {e}")))?;

    let inner_string = String::from_utf8(outer_decoded)
        .map_err(|e| Error::InvalidCertChain(format!("UTF-8 decode failed: {e}")))?;

    let cert_strings: Vec<&str> = inner_string.split(',').collect();
    if cert_strings.is_empty() {
        return Err(Error::InvalidCertChain("empty certificate chain".into()));
    }

    let mut certificates = Vec::with_capacity(cert_strings.len());
    for (i, cert_b64) in cert_strings.iter().enumerate() {
        let cert_der = Base64::decode_vec(cert_b64.trim())
            .map_err(|e| Error::InvalidCertChain(format!("cert {i} base64 decode failed: {e}")))?;

        let cert = Certificate::from_der(&cert_der)
            .map_err(|e| Error::InvalidCertChain(format!("cert {i} DER parse failed: {e}")))?;

        certificates.push(cert);
    }

    Ok(certificates)
}

/// Validate that the certificate chain roots to a known Google attestation CA.
///
/// Verifies:
/// 1. Chain root matches a known Google root by subject
/// 2. Each certificate is signed by the next certificate in the chain
/// 3. Root certificate's self-signature is valid
pub fn validate_certificate_chain(
    certificates: &[Certificate],
    allow_software_root: bool,
) -> Result<(), Error> {
    if certificates.is_empty() {
        return Err(Error::InvalidCertChain("empty chain".into()));
    }

    let chain_root = certificates
        .last()
        .ok_or_else(|| Error::InvalidCertChain("empty chain".into()))?;

    // Check if chain root matches any known Google root
    if !matches_google_root(chain_root, allow_software_root) {
        return Err(Error::UntrustedRoot);
    }

    // Verify each certificate is signed by the next in the chain
    for i in 0..certificates.len() {
        let subject = &certificates[i];
        let issuer = if i + 1 < certificates.len() {
            &certificates[i + 1]
        } else {
            // Root cert: verify self-signature
            subject
        };

        let key = VerifyingKey::try_from(issuer)
            .map_err(|e| Error::CertSignatureInvalid(format!("cert {i} issuer key: {e}")))?;

        key.verify(subject)
            .map_err(|e| Error::CertSignatureInvalid(format!("cert {i} signature: {e}")))?;
    }

    Ok(())
}

/// Check if a certificate matches any known Google attestation root CA.
fn matches_google_root(cert: &Certificate, allow_software_root: bool) -> bool {
    let Some(roots) = GOOGLE_ROOTS.as_ref() else {
        return false;
    };

    let cert_subject = &cert.tbs_certificate.subject;

    if cert_subject == &roots.hardware_rsa.tbs_certificate.subject
        || cert_subject == &roots.hardware_ec.tbs_certificate.subject
    {
        return true;
    }

    if allow_software_root
        && let Some(sw) = &roots.software
        && cert_subject == &sw.tbs_certificate.subject
    {
        return true;
    }

    false
}

/// Extract the uncompressed public key from a certificate as hex.
pub fn extract_public_key_hex(cert: &Certificate) -> String {
    let key_bytes = cert
        .tbs_certificate
        .subject_public_key_info
        .subject_public_key
        .raw_bytes();
    hex::encode(key_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_empty_attestation() {
        let result = decode_certificate_chain("");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_base64() {
        let result = decode_certificate_chain("not-valid-base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_empty_chain() {
        let result = validate_certificate_chain(&[], true);
        assert!(result.is_err());
    }

    #[test]
    fn test_google_roots_parse() {
        // Hardware roots must parse successfully
        let rsa = Certificate::from_pem(crate::constants::GOOGLE_HARDWARE_ROOT_RSA);
        assert!(rsa.is_ok(), "RSA root parse failed: {rsa:?}");

        let ec = Certificate::from_pem(crate::constants::GOOGLE_HARDWARE_ROOT_EC);
        assert!(ec.is_ok(), "EC root parse failed: {ec:?}");

        // Software root may fail (non-conformant DER, expired Jan 2026)
        // — this is handled gracefully as Option<Certificate>

        // Verify the LazyLock resolves to Some (hardware roots parsed)
        assert!(
            GOOGLE_ROOTS.is_some(),
            "GOOGLE_ROOTS LazyLock is None — hardware root certs failed to parse"
        );
    }
}
