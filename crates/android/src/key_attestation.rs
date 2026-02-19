use sha2::{Digest, Sha256};

use crate::certificate::{
    decode_certificate_chain, extract_public_key_hex, validate_certificate_chain,
};
use crate::error::Error;
use crate::extension::{extract_package_name, parse_key_description};
use crate::types::KeyAttestationResult;

/// Validate Android Key Attestation and return the public key for signature verification.
///
/// # Arguments
/// * `attestation` - Base64-encoded attestation chain from pagopa library
/// * `expected_challenge` - The challenge embedded in the cert (usually `deviceKeyId`)
/// * `expected_package_name` - Expected app package name (e.g., `"com.anonymous.zcam1"`)
/// * `production` - If `true`, require TEE or `StrongBox`; if `false`, allow Software keys
///
/// # Returns
/// * `KeyAttestationResult` containing the extracted public key and validation details
pub fn validate_key_attestation(
    attestation: &str,
    expected_challenge: &str,
    expected_package_name: &str,
    production: bool,
) -> Result<KeyAttestationResult, Error> {
    // 1. Decode certificate chain from pagopa format
    let certificates = decode_certificate_chain(attestation)?;

    // 2. Validate chain roots to a Google attestation CA
    let allow_software_root = !production;
    validate_certificate_chain(&certificates, allow_software_root)?;

    // 3. Get leaf certificate (first in chain, contains KeyDescription)
    let leaf_cert = certificates
        .first()
        .ok_or_else(|| Error::InvalidCertChain("empty chain".into()))?;

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

    // 6. Verify security levels meet requirements
    if production {
        if !key_desc.attestation_security_level.is_hardware_backed() {
            return Err(Error::SecurityLevelTooLow {
                field: "Attestation",
                actual: key_desc.attestation_security_level,
            });
        }
        if !key_desc.keymint_security_level.is_hardware_backed() {
            return Err(Error::SecurityLevelTooLow {
                field: "KeyMint",
                actual: key_desc.keymint_security_level,
            });
        }
    }

    // 7. Verify package name (if available in attestation)
    let package_name = extract_package_name(&key_desc);
    if let Some(ref actual_package) = package_name
        && actual_package != expected_package_name
    {
        return Err(Error::PackageNameMismatch {
            expected: expected_package_name.to_string(),
            actual: actual_package.clone(),
        });
    }

    // 8. Extract public key from leaf certificate
    let public_key_hex = extract_public_key_hex(leaf_cert);

    // 9. Compute key ID = SHA-256 of public key bytes
    let public_key_bytes = hex::decode(&public_key_hex)
        .map_err(|e| Error::PublicKeyError(format!("hex decode: {e}")))?;
    let key_id = Sha256::digest(&public_key_bytes);
    let key_id_hex = hex::encode(key_id);

    Ok(KeyAttestationResult {
        public_key_hex,
        key_id_hex,
        security_level: key_desc.attestation_security_level,
        package_name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64ct::{Base64, Encoding};
    use x509_verify::der::{DecodePem, Encode};

    /// Encode a single DER certificate into pagopa attestation format:
    /// `base64(base64(cert_der))`
    fn make_pagopa_attestation(cert_der: &[u8]) -> String {
        let inner_b64 = Base64::encode_string(cert_der);
        Base64::encode_string(inner_b64.as_bytes())
    }

    /// Encode multiple DER certificates into pagopa attestation format:
    /// `base64(base64(cert1) + "," + base64(cert2) + ...)`
    fn make_pagopa_chain(certs_der: &[Vec<u8>]) -> String {
        let inner = certs_der
            .iter()
            .map(|der| Base64::encode_string(der))
            .collect::<Vec<_>>()
            .join(",");
        Base64::encode_string(inner.as_bytes())
    }

    #[test]
    fn test_empty_attestation() {
        let result = validate_key_attestation("", "challenge", "com.example", false);
        assert!(matches!(result, Err(Error::InvalidCertChain(_))));
    }

    #[test]
    fn test_invalid_base64_attestation() {
        let result = validate_key_attestation("not-valid!!!", "challenge", "com.example", false);
        assert!(matches!(result, Err(Error::InvalidCertChain(_))));
    }

    #[test]
    fn test_invalid_inner_cert() {
        // Valid outer base64, but inner content is not a valid certificate
        let attestation = Base64::encode_string(b"not_a_cert_at_all");
        let result = validate_key_attestation(&attestation, "challenge", "com.example", false);
        assert!(matches!(result, Err(Error::InvalidCertChain(_))));
    }

    #[test]
    fn test_google_root_missing_extension() {
        // A real Google root cert passes chain validation (it IS a Google
        // root, self-signed) but does NOT contain the KeyDescription extension.
        // This exercises: decode → chain validation → extension parsing.
        let root_cert =
            x509_cert::Certificate::from_pem(crate::constants::GOOGLE_HARDWARE_ROOT_RSA)
                .expect("Google RSA root cert should parse");
        let root_der = root_cert.to_der().expect("should encode to DER");

        let attestation = make_pagopa_attestation(&root_der);
        let result = validate_key_attestation(&attestation, "challenge", "com.example", false);
        assert!(
            matches!(result, Err(Error::ExtensionNotFound)),
            "Expected ExtensionNotFound, got: {result:?}"
        );
    }

    #[test]
    fn test_google_root_chain_missing_extension() {
        // Two copies of the same Google root — validates chain signatures,
        // but leaf has no KeyDescription extension.
        let root_cert =
            x509_cert::Certificate::from_pem(crate::constants::GOOGLE_HARDWARE_ROOT_RSA)
                .expect("Google RSA root cert should parse");
        let root_der = root_cert.to_der().expect("should encode to DER");

        let attestation = make_pagopa_chain(&[root_der.clone(), root_der]);
        let result = validate_key_attestation(&attestation, "challenge", "com.example", false);
        assert!(
            matches!(result, Err(Error::ExtensionNotFound)),
            "Expected ExtensionNotFound, got: {result:?}"
        );
    }

    #[test]
    fn test_ec_root_missing_extension() {
        // Same test with the EC P-384 root cert
        let root_cert = x509_cert::Certificate::from_pem(crate::constants::GOOGLE_HARDWARE_ROOT_EC)
            .expect("Google EC root cert should parse");
        let root_der = root_cert.to_der().expect("should encode to DER");

        let attestation = make_pagopa_attestation(&root_der);
        let result = validate_key_attestation(&attestation, "challenge", "com.example", false);
        assert!(
            matches!(result, Err(Error::ExtensionNotFound)),
            "Expected ExtensionNotFound, got: {result:?}"
        );
    }
}
