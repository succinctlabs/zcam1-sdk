use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthInputs {
    pub photo_bytes: Vec<u8>,
    pub format: String,
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
