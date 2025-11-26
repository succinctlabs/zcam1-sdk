use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttestationStatement {
    pub x5c: Vec<String>,
    // pub alg: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttestationObject {
    pub fmt: String,
    pub att_stmt: AttestationStatement,
    pub auth_data: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssertionObject {
    pub signature: Vec<u8>,
    pub authenticator_data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AttestedCredentialData {
    pub aaguid: Vec<u8>,
    pub credential_id: Vec<u8>,
    pub credential_public_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthenticatorData {
    pub rp_id: Vec<u8>, // 32 bytes
    pub flags: u8,      // 1 byte
    pub counter: u32,
    pub aaguid: Option<Vec<u8>>, // pub att_data: AttestedCredentialData,
                                 // pub ext_data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientData {
    pub challenge: String,
}
