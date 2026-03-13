use serde::{Deserialize, Serialize};

use crate::{APPLE_ROOT_CERT, GOOGLE_HARDWARE_ROOT_EC, GOOGLE_HARDWARE_ROOT_RSA};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthInputs {
    pub photo_bytes: Vec<u8>,
    pub format: String,
    pub production: bool,
}

#[cfg(feature = "proving")]
impl From<AuthInputs> for sp1_sdk::SP1Stdin {
    fn from(inputs: AuthInputs) -> Self {
        let mut stdin = sp1_sdk::SP1Stdin::new();

        stdin.write(&inputs);

        stdin
    }
}

#[uniffi::export]
pub fn root_certs(platform: &str) -> Vec<u8> {
    match platform {
        "android" => {
            let root_cert = format!("{GOOGLE_HARDWARE_ROOT_RSA}{GOOGLE_HARDWARE_ROOT_EC}");
            root_cert.as_bytes().to_vec()
        }
        "ios" | "macos" => APPLE_ROOT_CERT.as_bytes().to_vec(),
        _ => unimplemented!(),
    }
}
