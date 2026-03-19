use base64ct::{Base64UrlUnpadded, Encoding};
use c2pa::{
    crypto::cose::{check_end_entity_certificate_profile, CertificateTrustPolicy},
    status_tracker::StatusTracker,
};
use p256::ecdsa::SigningKey;
use p256::elliptic_curve::rand_core::OsRng;
use x509_parser::{
    pem::Pem,
    prelude::{BasicExtension, FromDer, ParsedExtension, X509Certificate},
};
use zcam1_certs_utils::{build_self_signed_certificate, JwkEcKey, SelfSignedCertChain};

/// Generate a random P-256 JWK for testing.
fn random_jwk() -> JwkEcKey {
    let sk = SigningKey::random(&mut OsRng);
    let vk = sk.verifying_key();
    let pt = vk.to_encoded_point(false);
    JwkEcKey {
        kty: "EC".into(),
        crv: "P-256".into(),
        x: Base64UrlUnpadded::encode_string(pt.x().unwrap()),
        y: Base64UrlUnpadded::encode_string(pt.y().unwrap()),
    }
}

/// Build a fresh cert chain and return the PEM string.
fn build_chain() -> String {
    build_self_signed_certificate(&random_jwk(), None).unwrap()
}

/// Parse a PEM chain string into a vec of parsed X.509 certificates.
fn parse_chain(pem_chain: &str) -> Vec<X509Certificate<'_>> {
    Pem::iter_from_buffer(pem_chain.as_bytes())
        .map(|p| {
            let pem = p.unwrap();
            // Leak the DER bytes so the parsed cert can borrow them with 'static lifetime.
            // Fine for tests.
            let der: &'static [u8] = Vec::leak(pem.contents);
            let (_, cert) = X509Certificate::from_der(der).unwrap();
            cert
        })
        .collect()
}

/// Extract the leaf (first) certificate DER bytes from a PEM chain.
fn leaf_der(chain_pem: &str) -> Vec<u8> {
    let mut pems = Pem::iter_from_buffer(chain_pem.as_bytes());
    pems.next().unwrap().unwrap().contents
}

// ── Chain structure ──────────────────────────────────────────────────

#[test]
fn test_build_produces_three_certs() {
    let chain_pem = build_chain();

    let cert_count = chain_pem.matches("-----BEGIN CERTIFICATE-----").count();
    assert_eq!(
        cert_count, 3,
        "Chain should have exactly 3 certificates (leaf, intermediate, root)"
    );

    let certs = parse_chain(&chain_pem);
    assert_eq!(certs.len(), 3);

    // Verify CA flags
    assert!(!certs[0].tbs_certificate.is_ca(), "Leaf should not be a CA");
    assert!(
        certs[1].tbs_certificate.is_ca(),
        "Intermediate should be a CA"
    );
    assert!(certs[2].tbs_certificate.is_ca(), "Root should be a CA");
}

#[test]
fn test_root_is_self_signed() {
    let chain_pem = build_chain();
    let certs = parse_chain(&chain_pem);
    let root = &certs[2];

    assert_eq!(
        root.issuer(),
        root.subject(),
        "Root cert should be self-signed"
    );
}

#[test]
fn test_chain_issuer_subject_linkage() {
    let chain_pem = build_chain();
    let certs = parse_chain(&chain_pem);

    assert_eq!(
        certs[0].issuer(),
        certs[1].subject(),
        "Leaf issuer should match intermediate subject"
    );
    assert_eq!(
        certs[1].issuer(),
        certs[2].subject(),
        "Intermediate issuer should match root subject"
    );
}

// ── Leaf cert properties ─────────────────────────────────────────────

#[test]
fn test_leaf_subject_matches_input() {
    let jwk = random_jwk();
    let params = SelfSignedCertChain {
        root_cert_subject: "Test Root".into(),
        intermediate_cert_subject: "Test Intermediate".into(),
        leaf_cert_subject: "My Custom Leaf".into(),
        leaf_organization: "My Custom Org".into(),
    };
    let chain_pem = build_self_signed_certificate(&jwk, Some(params)).unwrap();
    let certs = parse_chain(&chain_pem);

    let subject_str = certs[0].subject().to_string();
    assert!(
        subject_str.contains("My Custom Leaf"),
        "Leaf subject should contain CN: {subject_str}"
    );
    assert!(
        subject_str.contains("My Custom Org"),
        "Leaf subject should contain org: {subject_str}"
    );
}

#[test]
fn test_leaf_pubkey_matches_input_jwk() {
    let sk = SigningKey::random(&mut OsRng);
    let vk = sk.verifying_key();
    let pt = vk.to_encoded_point(false);
    let jwk = JwkEcKey {
        kty: "EC".into(),
        crv: "P-256".into(),
        x: Base64UrlUnpadded::encode_string(pt.x().unwrap()),
        y: Base64UrlUnpadded::encode_string(pt.y().unwrap()),
    };

    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();
    let certs = parse_chain(&chain_pem);

    let leaf_pubkey_bytes: Vec<u8> = certs[0]
        .tbs_certificate
        .subject_pki
        .subject_public_key
        .data
        .to_vec();

    assert_eq!(
        leaf_pubkey_bytes.as_slice(),
        pt.as_bytes(),
        "Leaf cert public key should match the input JWK"
    );
}

// ── C2PA compliance ──────────────────────────────────────────────────

#[test]
fn test_leaf_cert_passes_c2pa_profile() {
    let chain = build_chain();
    let der = leaf_der(&chain);

    let mut validation_log = StatusTracker::default();
    let ctp = CertificateTrustPolicy::default();
    let result = check_end_entity_certificate_profile(&der, &ctp, &mut validation_log, None);

    assert!(
        result.is_ok(),
        "Generated leaf cert should pass C2PA end-entity profile check: {validation_log:#?}"
    );
}

#[test]
fn test_leaf_cert_extensions() {
    let chain = build_chain();
    let der = leaf_der(&chain);
    let (_, sign_cert) = X509Certificate::from_der(&der).unwrap();
    let tbs_cert = &sign_cert.tbs_certificate;

    // Check EKU
    let mut extended_key_usage_good = true;
    if let Some(BasicExtension { value: eku, .. }) = tbs_cert.extended_key_usage().unwrap() {
        if eku.any {
            extended_key_usage_good = false;
        }
        // Must have exactly one of ocsp_signing or time_stamping, and no other conflicting EKUs
        if (eku.ocsp_signing && eku.time_stamping)
            || ((eku.ocsp_signing ^ eku.time_stamping)
                && (eku.client_auth
                    | eku.code_signing
                    | eku.email_protection
                    | eku.server_auth
                    | !eku.other.is_empty()))
        {
            extended_key_usage_good = false;
        }
        // Verify specifically that timeStamping is set (current code behavior)
        assert!(eku.time_stamping, "Leaf cert should have timeStamping EKU");
        assert!(!eku.client_auth, "Leaf cert should not have clientAuth EKU");
    } else {
        extended_key_usage_good = false;
    }

    // Check other extensions
    let mut aki_good = false;
    let mut key_usage_good = false;
    let mut handled_all_critical = true;

    for e in sign_cert.extensions() {
        match e.parsed_extension() {
            ParsedExtension::AuthorityKeyIdentifier(_) => aki_good = true,
            ParsedExtension::KeyUsage(ku) => {
                if ku.digital_signature() || ku.key_cert_sign() || ku.non_repudiation() {
                    key_usage_good = true;
                }
            }
            ParsedExtension::BasicConstraints(_)
            | ParsedExtension::SubjectKeyIdentifier(_)
            | ParsedExtension::ExtendedKeyUsage(_) => (),
            ParsedExtension::Unparsed | _ => {
                if e.critical {
                    handled_all_critical = false;
                }
            }
        }
    }

    assert!(!tbs_cert.is_ca(), "Leaf cert should not be a CA");
    assert!(aki_good, "Authority Key Identifier should be present");
    assert!(
        key_usage_good,
        "Key Usage should include digitalSignature, keyCertSign, or nonRepudiation"
    );
    assert!(handled_all_critical, "Unhandled critical extensions found");
    assert!(extended_key_usage_good, "Extended Key Usage check failed");
}

// ── Edge cases ───────────────────────────────────────────────────────

#[test]
fn test_default_params() {
    let result = build_self_signed_certificate(&random_jwk(), None);
    assert!(
        result.is_ok(),
        "build_self_signed_certificate with None params should succeed"
    );
}

#[test]
fn test_invalid_jwk_returns_error() {
    let bad_jwk = JwkEcKey {
        kty: "EC".into(),
        crv: "P-256".into(),
        x: "not-valid-base64!!!".into(),
        y: "also-not-valid!!!".into(),
    };

    let result = build_self_signed_certificate(&bad_jwk, None);
    assert!(
        result.is_err(),
        "Invalid JWK coordinates should produce an error, not a panic"
    );
}
