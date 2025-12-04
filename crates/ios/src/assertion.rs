use p256::{
    PublicKey,
    ecdsa::{Signature, VerifyingKey, signature::Verifier},
};
use sha2::{Digest, Sha256};

use crate::{Error, types::AssertionObject, utils::decode_auth_data};

pub fn validate_assertion(
    assertion: AssertionObject,
    client_data: &[u8],
    public_key_uncompressed_hex: String,
    client_app_id: String,
    prev_counter: u32,
) -> Result<bool, Error> {
    // 1. sha256 hash the clientData
    let mut hasher = Sha256::new();
    hasher.update(client_data);
    let client_data_hash = hasher.finalize();

    // 2. Create nonce.
    hasher = Sha256::new();
    let mut nonce_raw: Vec<u8> = assertion.authenticator_data.clone();
    nonce_raw.extend(&client_data_hash);
    hasher.update(nonce_raw);
    let nonce_hash = hasher.finalize();

    // 3. Verify signature over nonce.
    let public_key_uncompressed = hex::decode(public_key_uncompressed_hex).expect("decoding error");
    let public_key = PublicKey::from_sec1_bytes(&public_key_uncompressed).expect("import error");
    let verifying_key = VerifyingKey::from(&public_key);

    let signature = Signature::from_der(&assertion.signature).expect("deserializing error");

    verifying_key.verify(&nonce_hash, &signature)?;

    let auth_data = decode_auth_data(assertion.authenticator_data.clone()).expect("decoding error");

    // 4. Verify RP ID.
    hasher = Sha256::new();
    hasher.update(client_app_id.clone());
    let client_app_id_hash = hasher.finalize();
    if auth_data.rp_id != client_app_id_hash.to_vec() {
        println!("RP ID is not equal");
        return Ok(false);
    }

    // 5. Verify counter.
    if auth_data.counter <= prev_counter {
        println!("counter is less than prev counter");
        return Ok(false);
    }

    Ok(true)
}
