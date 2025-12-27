use crate::{builder::CertChainBuilder, error::Error};

mod builder;
mod error;

uniffi::setup_scaffolding!();

#[derive(uniffi::Record)]
pub struct JwkEcKey {
    pub kty: String,
    pub crv: String,
    pub x: String,
    pub y: String,
}

#[derive(uniffi::Record)]
pub struct SelfSignedCertChain {
    pub root_cert_subject: String,
    pub intermediate_cert_subject: String,
    pub leaf_cert_subject: String,
    pub leaf_organization: String,
}

impl Default for SelfSignedCertChain {
    fn default() -> Self {
        Self {
            root_cert_subject: String::from("ZCAM1 Root Certificate"),
            intermediate_cert_subject: String::from("ZCAM1 Intermediate Certificate"),
            leaf_cert_subject: String::from("ZCAM1 Leaf Certificate"),
            leaf_organization: String::from("Succinct Certificate"),
        }
    }
}

impl TryFrom<&JwkEcKey> for p256::elliptic_curve::JwkEcKey {
    type Error = serde_json::Error;

    fn try_from(jwk: &JwkEcKey) -> Result<Self, Self::Error> {
        let jwk_value = serde_json::json!({
            "kty": jwk.kty,
            "crv": jwk.crv,
            "x": jwk.x,
            "y": jwk.y,
        });

        serde_json::from_value(jwk_value)
    }
}

#[uniffi::export(default(cert_chain_params = None))]
pub fn build_self_signed_certificate(
    leaf_jwk: &JwkEcKey,
    cert_chain_params: Option<SelfSignedCertChain>,
) -> Result<String, Error> {
    let cert_chain_params = cert_chain_params.unwrap_or_default();
    let cert_chain = CertChainBuilder::new()
        .self_signed(
            &cert_chain_params.root_cert_subject,
            &cert_chain_params.intermediate_cert_subject,
        )?
        .build(
            &leaf_jwk.try_into()?,
            &cert_chain_params.leaf_cert_subject,
            &cert_chain_params.leaf_organization,
        )?;

    Ok(cert_chain)
}
