use base64ct::{Base64, Encoding};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sp1_uniffi_verifier as _;

use zcam1_ios::{validate_assertion, validate_attestation};

use crate::error::VerifyError;

uniffi::setup_scaffolding!();

mod error;

#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
pub struct DeviceBindings {
    pub app_id: String,
    pub device_key_id: String,
    pub attestation: String,
    pub assertion: String,
}
