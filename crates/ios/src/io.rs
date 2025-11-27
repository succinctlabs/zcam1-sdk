use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthInputs {
    pub attestation: String, // b64
    pub assertion: String,   // b64
    pub key_id: String,      // b64
    pub data_hash: Vec<u8>,
    pub challenge: String,
    pub app_id: String,
    pub app_attest_production: bool,
}

#[cfg(feature = "proving")]
impl From<AuthInputs> for sp1_sdk::SP1Stdin {
    fn from(inputs: AuthInputs) -> Self {
        let mut stdin = sp1_sdk::SP1Stdin::new();

        stdin.write(&inputs);

        stdin
    }
}
