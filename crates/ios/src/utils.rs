use crate::types::{
    AssertionObject, AttestationObject, AttestationStatement, AuthenticatorData, ClientData,
};
use base64ct::{Base64, Base64Unpadded, Encoding};

use serde_cbor::{Value, from_slice};

// Parse b64 to pem.
pub fn b64_to_pem(b64: &str) -> String {
    let mut pem = String::from("-----BEGIN CERTIFICATE-----\n");
    for i in 0..b64.len() / 64 {
        pem.push_str(&b64[i * 64..(i + 1) * 64]);
        pem.push('\n');
    }
    pem.push_str(&b64[(b64.len() / 64) * 64..]);
    pem.push_str("\n-----END CERTIFICATE-----");
    pem
}

// Decode base64 string into assertion object.
pub fn decode_attestation(encoded: String) -> Result<AttestationObject, serde_json::Error> {
    // Somtimes attestation is padded with '=' and sometimes not.
    let decoded = if encoded.ends_with('=') {
        Base64::decode_vec(&encoded).expect("decoding error")
    } else {
        Base64Unpadded::decode_vec(&encoded).expect("decoding error")
    };
    let cbor: Value = from_slice(&decoded).expect("decoding error");
    let json_str = serde_json::to_string(&cbor).expect("decoding error");
    let attestation: serde_json::Value = serde_json::from_str(&json_str).expect("decoding error");

    Ok(AttestationObject {
        fmt: attestation["fmt"].as_str().unwrap().to_string(),
        att_stmt: AttestationStatement {
            x5c: attestation["attStmt"]["x5c"]
                .as_array()
                .unwrap()
                .iter()
                .map(|x| match x {
                    serde_json::Value::Array(a) => {
                        let bytes: Vec<u8> = a
                            .iter()
                            .map(|v| match v {
                                serde_json::Value::Number(i) => i.as_u64().unwrap() as u8,
                                _ => panic!("Unexpected value in x5c"),
                            })
                            .collect();
                        Base64::encode_string(&bytes)
                    }
                    _ => panic!("Unexpected value in x5c"),
                })
                .collect(),
        },
        auth_data: Base64::encode_string(
            &attestation["authData"]
                .as_array()
                .unwrap()
                .iter()
                .map(|x| match x {
                    serde_json::Value::Number(i) => i.as_u64().unwrap() as u8,
                    _ => panic!("Unexpected value in authData"),
                })
                .collect::<Vec<u8>>(),
        ),
    })
}

// Decode base64 string into assertion object.
pub fn decode_assertion(encoded: String) -> Result<AssertionObject, serde_json::Error> {
    let decoded = if encoded.ends_with('=') {
        Base64::decode_vec(&encoded).expect("decoding error")
    } else {
        Base64Unpadded::decode_vec(&encoded).expect("decoding error")
    };
    let cbor: Value = from_slice(&decoded).expect("decoding error");
    let json_str = serde_json::to_string(&cbor).expect("decoding error");
    let assertion: AssertionObject = serde_json::from_str(&json_str).expect("decoding error");

    Ok(assertion)
}

// Decode for AuthenticatorData.
pub fn decode_auth_data(s: Vec<u8>) -> Result<AuthenticatorData, serde_json::Error> {
    let auth_data = AuthenticatorData {
        rp_id: (s[0..32]).to_vec(),
        flags: s[32],
        counter: u32::from_be_bytes(s[33..37].try_into().unwrap()),
        aaguid: if s.len() > 53 {
            Some((s[37..53]).to_vec())
        } else {
            None
        },
    };
    Ok(auth_data)
}

// Base64 decode.
pub fn decode_base64_to_bytes(encoded: &str) -> Result<Vec<u8>, base64ct::Error> {
    Base64::decode_vec(encoded)
}

// Decode ClientData.
pub fn decode_client_data(encoded: String) -> Result<ClientData, serde_json::Error> {
    let client_data: ClientData = serde_json::from_str(encoded.clone().as_str())?;
    Ok(client_data)
}
