use std::{str::FromStr, time::Duration};

use base64ct::LineEnding;
use der::{Decode, EncodePem, oid::db::rfc5280::ID_KP_TIME_STAMPING};
use p256::{
    ecdsa::{SigningKey, VerifyingKey},
    elliptic_curve::{
        JwkEcKey,
        rand_core::{OsRng, RngCore},
    },
    pkcs8::{DecodePrivateKey, EncodePublicKey},
};
use rcgen::{CertificateParams, IsCa, KeyPair, KeyUsagePurpose};
use serde_json::Value;
use spki::SubjectPublicKeyInfoOwned;
use thiserror::Error;
use x509_cert::{
    builder::{Builder, CertificateBuilder, Profile},
    ext::pkix::ExtendedKeyUsage,
    name::Name,
    serial_number::SerialNumber,
    time::Validity,
};

#[derive(Debug, Error)]
pub enum CertsError {
    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    RcGen(#[from] rcgen::Error),

    #[error(transparent)]
    Der(#[from] der::Error),

    #[error(transparent)]
    Spki(#[from] spki::Error),

    #[error(transparent)]
    Pkcs8(#[from] p256::pkcs8::Error),

    #[error(transparent)]
    EllipticCurve(#[from] p256::elliptic_curve::Error),

    #[error(transparent)]
    X509Cert(#[from] x509_cert::builder::Error),
}

#[derive(Debug)]
struct CaCert {
    ca_cert_pem: String,
    ca_signing_key: SigningKey,
    ca_subject_name: Name,
}

pub fn generate_cert_chain(
    jwk: Value,
    subject: &str,
    organization: &str,
) -> Result<String, CertsError> {
    let leaf_public_key = serde_json::from_value::<JwkEcKey>(jwk)?;
    let root_cert = setup_root_ca()?;
    let intermediate_cert = setup_intermediate_ca(&root_cert)?;
    let leaf_pem = build_leaf_cert(
        &intermediate_cert,
        leaf_public_key.to_public_key()?.into(),
        subject,
        organization,
    )?;

    Ok(format!(
        "{}{}{}",
        leaf_pem, intermediate_cert.ca_cert_pem, root_cert.ca_cert_pem
    ))
}

fn setup_root_ca() -> Result<CaCert, CertsError> {
    let mut params = CertificateParams::new(vec!["My Backend Root CA".to_string()])?;
    params.is_ca = IsCa::Ca(rcgen::BasicConstraints::Constrained(0));
    params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];

    let ca_key_pair = KeyPair::generate()?;
    let ca_cert = params.self_signed(&ca_key_pair)?;
    let ca_cert_pem = ca_cert.pem();

    let key_pem = ca_key_pair.serialize_pem();
    let ca_signing_key = SigningKey::from_pkcs8_pem(&key_pem)?;

    let cert_der = ca_cert.der();
    let x509_parsed = x509_cert::Certificate::from_der(cert_der)?;
    let ca_subject_name = x509_parsed.tbs_certificate.subject;

    Ok(CaCert {
        ca_cert_pem,
        ca_signing_key,
        ca_subject_name,
    })
}

fn setup_intermediate_ca(root: &CaCert) -> Result<CaCert, CertsError> {
    // Generate key pair for the intermediate CA
    let intermediate_signing_key = SigningKey::random(&mut OsRng);
    let intermediate_verifying_key = VerifyingKey::from(&intermediate_signing_key);

    let spki_der = intermediate_verifying_key.to_public_key_der()?;
    let spki = SubjectPublicKeyInfoOwned::from_der(spki_der.as_bytes())?;

    let validity = Validity::from_now(Duration::from_secs(365 * 24 * 3600))?;
    let subject = Name::from_str("CN=My Backend Intermediate CA")?;
    let serial_number = SerialNumber::from(RngCore::next_u64(&mut OsRng));

    // Intermediate CA is issued by the root
    let builder = CertificateBuilder::new(
        Profile::SubCA {
            issuer: root.ca_subject_name.clone(),
            // No further subordinate CAs under this intermediate
            path_len_constraint: Some(0),
        },
        serial_number,
        validity,
        subject.clone(),
        spki,
        &root.ca_signing_key,
    )?;

    let cert = builder.build::<p256::ecdsa::DerSignature>()?;
    let ca_cert_pem = cert.to_pem(LineEnding::LF)?;

    Ok(CaCert {
        ca_cert_pem,
        ca_signing_key: intermediate_signing_key,
        ca_subject_name: subject,
    })
}

fn build_leaf_cert(
    ca_cert: &CaCert,
    client_pub_key: VerifyingKey,
    subject_cn: &str,
    organization: &str,
) -> Result<String, CertsError> {
    let spki_der = client_pub_key.to_public_key_der()?;
    let spki = SubjectPublicKeyInfoOwned::from_der(spki_der.as_bytes())?;

    let validity = Validity::from_now(Duration::from_secs(365 * 24 * 3600))?;
    let subject = Name::from_str(&format!("O={organization},CN={subject_cn}"))?;

    let serial_number = SerialNumber::from(RngCore::next_u64(&mut OsRng));

    let mut builder = CertificateBuilder::new(
        Profile::Leaf {
            issuer: ca_cert.ca_subject_name.clone(),
            enable_key_agreement: false,
            enable_key_encipherment: true,
        },
        serial_number,
        validity,
        subject,
        spki,
        &ca_cert.ca_signing_key,
    )?;

    // Extended Key Usage: id-kp-clientAuth (1.3.6.1.5.5.7.3.2)
    let eku = ExtendedKeyUsage(vec![ID_KP_TIME_STAMPING]);
    builder.add_extension(&eku)?;

    let cert = builder.build::<p256::ecdsa::DerSignature>()?;
    Ok(cert.to_pem(LineEnding::LF)?)
}
