use base64ct::{Base64, Encoding};
use ecdsa::signature::Verifier;
use p256::ecdsa::{Signature, VerifyingKey};
use p256::PublicKey;
use sha2::{Digest, Sha256};

use crate::error::Error;

/// Verify an ECDSA P-256 signature from Android Keystore.
///
/// Android signs using `SHA256withECDSA` which hashes the message internally.
/// The p256 crate's `verify()` also hashes internally, so we pass raw message bytes.
///
/// # Arguments
/// * `signature_b64` - Base64-encoded DER signature from `signWithHardwareKey()`
/// * `message` - The raw message that was signed (e.g., `"base64(photoHash)|base64(metadataHash)"`)
/// * `public_key_hex` - Public key in uncompressed hex format from `KeyAttestationResult`
pub fn verify_signature(
    signature_b64: &str,
    message: &str,
    public_key_hex: &str,
) -> Result<bool, Error> {
    let signature_bytes =
        Base64::decode_vec(signature_b64).map_err(|_| Error::SignatureInvalid)?;

    let signature =
        Signature::from_der(&signature_bytes).map_err(|_| Error::SignatureInvalid)?;

    let public_key_bytes =
        hex::decode(public_key_hex).map_err(|e| Error::PublicKeyError(format!("{e}")))?;

    let public_key = PublicKey::from_sec1_bytes(&public_key_bytes)
        .map_err(|e| Error::PublicKeyError(format!("{e}")))?;

    let verifying_key = VerifyingKey::from(&public_key);

    // Pass raw message - verify() hashes internally with SHA-256,
    // matching Android's SHA256withECDSA behavior
    verifying_key
        .verify(message.as_bytes(), &signature)
        .map(|()| true)
        .map_err(|_| Error::SignatureInvalid)
}

/// Verify that a photo hash and metadata reconstruct the expected signed message.
///
/// Expected message format: `base64(photoHash)|base64(sha256(metadata))`
pub fn verify_message_binding(
    photo_hash: &[u8],
    metadata: &str,
    signed_message: &str,
) -> Result<bool, Error> {
    let photo_hash_b64 = Base64::encode_string(photo_hash);
    let metadata_hash = Sha256::digest(metadata.as_bytes());
    let metadata_hash_b64 = Base64::encode_string(&metadata_hash);

    let expected_message = format!("{photo_hash_b64}|{metadata_hash_b64}");
    Ok(signed_message == expected_message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::SigningKey;
    use p256::ecdsa::signature::Signer;

    fn generate_test_keypair() -> (SigningKey, VerifyingKey) {
        let signing_key = SigningKey::random(&mut rand_core::OsRng);
        let verifying_key = *signing_key.verifying_key();
        (signing_key, verifying_key)
    }

    #[test]
    fn test_verify_valid_signature() {
        let (signing_key, verifying_key) = generate_test_keypair();

        let message = "dGVzdHBob3RvaGFzaA==|dGVzdG1ldGFkYXRhaGFzaA==";

        // Sign the message (SigningKey::sign hashes internally, matching Android)
        let signature: Signature = signing_key.sign(message.as_bytes());
        let der_sig = signature.to_der();
        let signature_b64 = Base64::encode_string(der_sig.as_bytes());

        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_hex = hex::encode(public_key_bytes.as_bytes());

        let result = verify_signature(&signature_b64, message, &public_key_hex);
        assert!(result.is_ok());
        assert!(result.is_ok_and(|v| v));
    }

    #[test]
    fn test_reject_invalid_signature() {
        let (_signing_key, verifying_key) = generate_test_keypair();

        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_hex = hex::encode(public_key_bytes.as_bytes());

        // Use a signature from a different key
        let (other_key, _) = generate_test_keypair();
        let signature: Signature = other_key.sign(b"some message");
        let signature_b64 = Base64::encode_string(signature.to_der().as_bytes());

        let result = verify_signature(&signature_b64, "some message", &public_key_hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_wrong_message() {
        let (signing_key, verifying_key) = generate_test_keypair();

        let signature: Signature = signing_key.sign(b"correct message");
        let signature_b64 = Base64::encode_string(signature.to_der().as_bytes());

        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_hex = hex::encode(public_key_bytes.as_bytes());

        let result = verify_signature(&signature_b64, "wrong message", &public_key_hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_malformed_signature() {
        let (_, verifying_key) = generate_test_keypair();
        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_hex = hex::encode(public_key_bytes.as_bytes());

        let result = verify_signature("bm90YXNpZw==", "msg", &public_key_hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_invalid_public_key() {
        let result = verify_signature("MEUCIQD=", "msg", "deadbeef");
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_message_binding() {
        let photo_hash = b"fakephotohash123";
        let metadata = r#"{"timestamp":"2026-01-01"}"#;

        let photo_b64 = Base64::encode_string(photo_hash);
        let metadata_hash = sha2::Sha256::digest(metadata.as_bytes());
        let metadata_b64 = Base64::encode_string(&metadata_hash);
        let message = format!("{photo_b64}|{metadata_b64}");

        let result = verify_message_binding(photo_hash, metadata, &message);
        assert!(result.is_ok_and(|v| v));
    }

    #[test]
    fn test_reject_wrong_message_binding() {
        let result = verify_message_binding(b"hash", "metadata", "wrong|message");
        assert!(result.is_ok_and(|v| !v));
    }
}
