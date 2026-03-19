use base64ct::{Base64, Base64Unpadded, Encoding};
use serde_cbor::{Value, from_slice};

use crate::{
    error::Error,
    types::{
        AssertionObject, AttestationObject, AttestationStatement, AuthenticatorData, ClientData,
    },
};

/// Parse b64 to pem.
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

/// Decode a base64-encoded string, trying both padded and unpadded variants.
fn decode_base64_flexible(encoded: &str) -> Result<Vec<u8>, Error> {
    // Try standard padded base64 first.
    if let Ok(decoded) = Base64::decode_vec(encoded) {
        return Ok(decoded);
    }
    // Fall back to unpadded base64.
    Base64Unpadded::decode_vec(encoded)
        .map_err(|e| Error::DecodeFailed(format!("base64 decode failed: {e}")))
}

/// Decode base64 string into attestation object.
pub fn decode_attestation(encoded: String) -> Result<AttestationObject, Error> {
    let decoded = decode_base64_flexible(&encoded)?;
    let cbor: Value = from_slice(&decoded)
        .map_err(|e| Error::DecodeFailed(format!("CBOR decode failed: {e}")))?;
    let json_str = serde_json::to_string(&cbor)
        .map_err(|e| Error::DecodeFailed(format!("CBOR to JSON failed: {e}")))?;
    let attestation: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| Error::DecodeFailed(format!("JSON parse failed: {e}")))?;

    let fmt = attestation["fmt"]
        .as_str()
        .ok_or_else(|| Error::DecodeFailed("missing 'fmt' field in attestation".to_string()))?
        .to_string();

    let x5c_array = attestation["attStmt"]["x5c"]
        .as_array()
        .ok_or_else(|| Error::DecodeFailed("missing 'attStmt.x5c' in attestation".to_string()))?;
    if x5c_array.is_empty() {
        return Err(Error::DecodeFailed(
            "empty 'attStmt.x5c' in attestation".to_string(),
        ));
    }

    let x5c: Vec<String> = x5c_array
        .iter()
        .map(|x| match x {
            serde_json::Value::Array(a) => {
                let bytes: Vec<u8> = a
                    .iter()
                    .filter_map(|v| v.as_u64().map(|i| i as u8))
                    .collect();
                Ok(Base64::encode_string(&bytes))
            }
            _ => Err(Error::DecodeFailed(
                "non-array entry in 'attStmt.x5c'".to_string(),
            )),
        })
        .collect::<Result<Vec<String>, Error>>()?;

    let auth_data_array = attestation["authData"]
        .as_array()
        .ok_or_else(|| Error::DecodeFailed("missing 'authData' in attestation".to_string()))?;

    let auth_data_bytes: Vec<u8> = auth_data_array
        .iter()
        .filter_map(|x| x.as_u64().map(|i| i as u8))
        .collect();

    Ok(AttestationObject {
        fmt,
        att_stmt: AttestationStatement { x5c },
        auth_data: Base64::encode_string(&auth_data_bytes),
    })
}

/// Decode base64 string into assertion object.
pub fn decode_assertion(encoded: String) -> Result<AssertionObject, Error> {
    let decoded = decode_base64_flexible(&encoded)?;
    let cbor: Value = from_slice(&decoded)
        .map_err(|e| Error::DecodeFailed(format!("CBOR decode failed: {e}")))?;
    let json_str = serde_json::to_string(&cbor)
        .map_err(|e| Error::DecodeFailed(format!("CBOR to JSON failed: {e}")))?;
    let assertion: AssertionObject = serde_json::from_str(&json_str)
        .map_err(|e| Error::DecodeFailed(format!("assertion JSON parse failed: {e}")))?;

    Ok(assertion)
}

/// Decode for `AuthenticatorData`.
pub fn decode_auth_data(s: Vec<u8>) -> Result<AuthenticatorData, Error> {
    if s.len() < 37 {
        return Err(Error::DecodeFailed(format!(
            "authenticator data too short: {} bytes, need at least 37",
            s.len()
        )));
    }

    let auth_data = AuthenticatorData {
        rp_id: (s[0..32]).to_vec(),
        flags: s[32],
        counter: u32::from_be_bytes(
            s[33..37]
                .try_into()
                .map_err(|e| Error::DecodeFailed(format!("counter parse failed: {e}")))?,
        ),
        aaguid: if s.len() > 53 {
            Some((s[37..53]).to_vec())
        } else {
            None
        },
    };
    Ok(auth_data)
}

/// Base64 decode.
pub fn decode_base64_to_bytes(encoded: &str) -> Result<Vec<u8>, base64ct::Error> {
    Base64::decode_vec(encoded)
}

/// Decode `ClientData`.
pub fn decode_client_data(encoded: String) -> Result<ClientData, serde_json::Error> {
    let client_data: ClientData = serde_json::from_str(encoded.clone().as_str())?;
    Ok(client_data)
}
