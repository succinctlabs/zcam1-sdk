use std::{str::FromStr, time::Duration};

use der::{oid::db::rfc5280::ID_KP_TIME_STAMPING, pem::LineEnding, Decode, EncodePem};
use p256::{
    ecdsa::{SigningKey, VerifyingKey},
    elliptic_curve::{
        rand_core::{OsRng, RngCore},
        JwkEcKey,
    },
    pkcs8::{DecodePrivateKey, EncodePublicKey},
};
use rcgen::{CertificateParams, IsCa, KeyPair, KeyUsagePurpose};
use spki::SubjectPublicKeyInfoOwned;
use x509_cert::{
    builder::{Builder, CertificateBuilder, Profile},
    ext::pkix::ExtendedKeyUsage,
    name::Name,
    serial_number::SerialNumber,
    time::Validity,
};

use crate::error::Error;

pub struct CertChainBuilder<C> {
    root_certificate: C,
    intermediate_cert: C,
}

impl CertChainBuilder<()> {
    pub fn new() -> Self {
        Self {
            root_certificate: (),
            intermediate_cert: (),
        }
    }

    pub fn self_signed(
        &self,
        root_cert_subject: &str,
        intermediate_cert_subject: &str,
    ) -> Result<CertChainBuilder<CaCert>, Error> {
        let mut params = CertificateParams::new(vec![root_cert_subject.to_string()])?;
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

        let root_certificate = CaCert {
            ca_cert_pem,
            ca_signing_key,
            ca_subject_name,
        };

        let intermediate_cert =
            build_intermediate_cert(&root_certificate, intermediate_cert_subject)?;

        Ok(CertChainBuilder {
            root_certificate,
            intermediate_cert,
        })
    }
}

impl CertChainBuilder<CaCert> {
    fn build_leaf_cert(
        &self,
        client_pub_key: VerifyingKey,
        subject_cn: &str,
        organization: &str,
    ) -> Result<String, Error> {
        let spki_der = client_pub_key.to_public_key_der()?;
        let spki = SubjectPublicKeyInfoOwned::from_der(spki_der.as_bytes())?;

        let validity = Validity::from_now(Duration::from_secs(365 * 24 * 3600))?;
        let subject = Name::from_str(&format!("O={},CN={}", organization, subject_cn))?;

        let serial_number = SerialNumber::from(RngCore::next_u64(&mut OsRng));

        let mut builder = CertificateBuilder::new(
            Profile::Leaf {
                issuer: self.intermediate_cert.ca_subject_name.clone(),
                enable_key_agreement: false,
                enable_key_encipherment: true,
            },
            serial_number,
            validity,
            subject,
            spki,
            &self.intermediate_cert.ca_signing_key,
        )?;

        // Extended Key Usage: id-kp-clientAuth (1.3.6.1.5.5.7.3.2)
        let eku = ExtendedKeyUsage(vec![ID_KP_TIME_STAMPING]);
        builder.add_extension(&eku)?;

        let cert = builder.build::<p256::ecdsa::DerSignature>()?;
        Ok(cert.to_pem(LineEnding::LF)?)
    }

    pub fn build(
        &self,
        leaf_jwk: &JwkEcKey,
        leaf_subject: &str,
        leaf_organization: &str,
    ) -> Result<String, Error> {
        let leaf_pem = self.build_leaf_cert(
            leaf_jwk.to_public_key()?.into(),
            leaf_subject,
            leaf_organization,
        )?;

        Ok(format!(
            "{}{}{}",
            leaf_pem, self.intermediate_cert.ca_cert_pem, self.root_certificate.ca_cert_pem
        ))
    }
}

fn build_intermediate_cert(root_certificate: &CaCert, subject: &str) -> Result<CaCert, Error> {
    // Generate key pair for the intermediate CA
    let intermediate_signing_key = SigningKey::random(&mut OsRng);
    let intermediate_verifying_key = VerifyingKey::from(&intermediate_signing_key);

    let spki_der = intermediate_verifying_key.to_public_key_der()?;
    let spki = SubjectPublicKeyInfoOwned::from_der(spki_der.as_bytes())?;

    let validity = Validity::from_now(Duration::from_secs(365 * 24 * 3600))?;
    let subject = Name::from_str(&format!("CN={subject}"))?;
    let serial_number = SerialNumber::from(RngCore::next_u64(&mut OsRng));

    // Intermediate CA is issued by the root
    let builder = CertificateBuilder::new(
        Profile::SubCA {
            issuer: root_certificate.ca_subject_name.clone(),
            // No further subordinate CAs under this intermediate
            path_len_constraint: Some(0),
        },
        serial_number,
        validity,
        subject.clone(),
        spki,
        &root_certificate.ca_signing_key,
    )?;

    let cert = builder.build::<p256::ecdsa::DerSignature>()?;
    let ca_cert_pem = cert.to_pem(LineEnding::LF)?;

    Ok(CaCert {
        ca_cert_pem,
        ca_signing_key: intermediate_signing_key,
        ca_subject_name: subject,
    })
}

#[derive(Debug)]
pub struct CaCert {
    ca_cert_pem: String,
    ca_signing_key: SigningKey,
    ca_subject_name: Name,
}
