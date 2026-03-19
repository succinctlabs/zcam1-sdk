use base64ct::{Base64UrlUnpadded, Encoding};
use p256::ecdsa::SigningKey;
use p256::elliptic_curve::rand_core::OsRng;
use x509_parser::{
    pem::Pem,
    prelude::{FromDer, X509Certificate},
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

#[test]
fn test_build_produces_three_certs() {
    let jwk = random_jwk();
    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();

    let cert_count = chain_pem.matches("-----BEGIN CERTIFICATE-----").count();
    assert_eq!(cert_count, 3, "Chain should have exactly 3 certificates (leaf, intermediate, root)");

    let certs = parse_chain(&chain_pem);
    assert_eq!(certs.len(), 3);
}

#[test]
fn test_root_is_ca() {
    let jwk = random_jwk();
    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();
    let certs = parse_chain(&chain_pem);
    let root = &certs[2];

    assert!(root.tbs_certificate.is_ca(), "Root cert should be a CA");

    // Root should be self-signed: issuer == subject
    assert_eq!(
        root.issuer(),
        root.subject(),
        "Root cert should be self-signed"
    );
}

#[test]
fn test_intermediate_signed_by_root() {
    let jwk = random_jwk();
    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();
    let certs = parse_chain(&chain_pem);
    let intermediate = &certs[1];
    let root = &certs[2];

    assert!(intermediate.tbs_certificate.is_ca(), "Intermediate cert should be a CA");

    // Intermediate's issuer should match root's subject
    assert_eq!(
        intermediate.issuer(),
        root.subject(),
        "Intermediate issuer should match root subject"
    );
}

#[test]
fn test_leaf_not_ca() {
    let jwk = random_jwk();
    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();
    let certs = parse_chain(&chain_pem);
    let leaf = &certs[0];
    let intermediate = &certs[1];

    assert!(!leaf.tbs_certificate.is_ca(), "Leaf cert should not be a CA");

    // Leaf's issuer should match intermediate's subject
    assert_eq!(
        leaf.issuer(),
        intermediate.subject(),
        "Leaf issuer should match intermediate subject"
    );
}

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
    let leaf = &certs[0];

    let subject_str = leaf.subject().to_string();
    assert!(
        subject_str.contains("My Custom Leaf"),
        "Leaf subject should contain the provided CN: {subject_str}"
    );
    assert!(
        subject_str.contains("My Custom Org"),
        "Leaf subject should contain the provided org: {subject_str}"
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
    let leaf = &certs[0];

    // Extract the raw public key bytes from the leaf cert
    let leaf_pubkey_bytes: Vec<u8> = leaf
        .tbs_certificate
        .subject_pki
        .subject_public_key
        .data
        .to_vec();

    // The input JWK's uncompressed point: 0x04 || x || y
    let expected_point = pt.as_bytes();

    assert_eq!(
        leaf_pubkey_bytes.as_slice(), expected_point,
        "Leaf cert public key should match the input JWK"
    );
}

#[test]
fn test_leaf_has_time_stamping_eku() {
    let jwk = random_jwk();
    let chain_pem = build_self_signed_certificate(&jwk, None).unwrap();
    let certs = parse_chain(&chain_pem);
    let leaf = &certs[0];

    let eku = leaf
        .tbs_certificate
        .extended_key_usage()
        .expect("EKU extension should parse")
        .expect("EKU extension should be present");

    // The code uses ID_KP_TIME_STAMPING (the comment in builder.rs says clientAuth,
    // but that's a known documentation bug — the code intentionally uses timeStamping
    // for C2PA compliance).
    assert!(
        eku.value.time_stamping,
        "Leaf cert should have timeStamping EKU"
    );
    assert!(
        !eku.value.client_auth,
        "Leaf cert should not have clientAuth EKU"
    );
}

#[test]
fn test_default_params() {
    let jwk = random_jwk();
    let result = build_self_signed_certificate(&jwk, None);
    assert!(result.is_ok(), "build_self_signed_certificate with None params should succeed");
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
    assert!(result.is_err(), "Invalid JWK coordinates should produce an error, not a panic");
}
