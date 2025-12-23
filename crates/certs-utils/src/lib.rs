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

#[uniffi::export]
pub fn build_self_signed_certificate(
    root_cert_subject: &str,
    intermediate_cert_subject: &str,
    leaf_subject: &str,
    leaf_organization: &str,
    leaf_jwk: &JwkEcKey,
) -> Result<String, Error> {
    let cert_chain = CertChainBuilder::new()
        .self_signed(root_cert_subject, intermediate_cert_subject)?
        .build(&leaf_jwk.try_into()?, leaf_subject, leaf_organization)?;

    Ok(cert_chain)
}
