use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthInputs {
    // Photo data fields (required by SP1 program)
    pub photo_bytes: Vec<u8>,
    pub format: String,

    // Attestation data fields (from backend)
    pub attestation: String,
    pub assertion: String,
    pub key_id: String,
    pub data_hash: Vec<u8>,
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
