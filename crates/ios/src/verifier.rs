use serde::{Deserialize, Serialize};

pub struct IosVerifier;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IosRegisterInputs {
    pub attestation: String,
    pub key_id: String,
    pub app_id: String,
    pub production: bool,
}
