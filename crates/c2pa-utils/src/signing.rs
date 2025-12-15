use security_framework::{
    item::{ItemClass, ItemSearchOptions, Reference, SearchResult},
    key::Algorithm,
};
use std::error::Error;

// Test key ID for simulator mode (SHA1 of the test public key).
pub const SIMULATOR_TEST_KEY_ID: [u8; 20] = [
    0x3e, 0xa8, 0x98, 0xc9, 0x39, 0x9f, 0x09, 0x10, 0xfe, 0xf2, 0xa6, 0x06, 0x6c, 0x20, 0x14, 0x6d,
    0xa6, 0x6d, 0x7f, 0x1b,
];

// Test private key for simulator mode (PEM format).
pub const SIMULATOR_TEST_PRIVATE_KEY_PEM: &str = r"-----BEGIN EC PRIVATE KEY-----
MHcCAQEEINR71n9TICE3+Ogmzo1ZmIH1529CF02siSJM+xXiFPCCoAoGCCqGSM49
AwEHoUQDQgAEGaY7CTjEOy5CnnYNWr1CZp4R18gE5TaiqiF3EXaiNypLXjDiu9Pc
IwkQqR2c5GIYQnzBq4v2EYHeTcGFkYs+Bw==
-----END EC PRIVATE KEY-----";

pub fn sign_with_enclave(application_label: &[u8], data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    // Log the application_label for debugging.
    eprintln!("[ZCAM DEBUG] sign_with_enclave called with key ID: {:?}", application_label);
    eprintln!("[ZCAM DEBUG] Expected test key ID: {:?}", SIMULATOR_TEST_KEY_ID);
    eprintln!("[ZCAM DEBUG] Match: {}", application_label == SIMULATOR_TEST_KEY_ID);

    // Check if this is the simulator test key.
    if application_label == SIMULATOR_TEST_KEY_ID {
        eprintln!("[ZCAM DEBUG] Using test key for signing");
        return sign_with_test_key(data);
    }

    eprintln!("[ZCAM DEBUG] Attempting to use Secure Enclave");
    let mut search_options = ItemSearchOptions::new();

    search_options
        .class(ItemClass::key())
        .application_label(application_label)
        .load_refs(true) // We want metadata, not the key ref
        .limit(1);

    let items = search_options.search()?;

    let key = match items.first() {
        Some(SearchResult::Ref(Reference::Key(k))) => k,
        _ => return Err("Key not found in Secure Enclave".into()),
    };

    let signature = key.create_signature(Algorithm::ECDSASignatureMessageX962SHA256, data)?;

    Ok(signature)
}

// Sign data using the simulator test private key.
fn sign_with_test_key(data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    use p256::ecdsa::{Signature, SigningKey, signature::Signer};
    use p256::pkcs8::DecodePrivateKey;

    eprintln!("[ZCAM DEBUG] sign_with_test_key: Starting signature generation");
    eprintln!("[ZCAM DEBUG] sign_with_test_key: Data to sign length: {} bytes", data.len());

    // Parse the PEM private key.
    let signing_key = SigningKey::from_pkcs8_pem(SIMULATOR_TEST_PRIVATE_KEY_PEM)?;

    // Sign the data.
    let signature: Signature = signing_key.sign(data);

    // Get the P1363 format (raw r||s bytes).
    let p1363_bytes = signature.to_bytes().to_vec();

    eprintln!("[ZCAM DEBUG] sign_with_test_key: Generated P1363 signature length: {} bytes", p1363_bytes.len());
    eprintln!("[ZCAM DEBUG] sign_with_test_key: First 16 bytes of signature: {:02x?}", &p1363_bytes[..16.min(p1363_bytes.len())]);

    // Verify this is NOT DER format by checking if it starts with 0x30 (DER SEQUENCE tag).
    if !p1363_bytes.is_empty() && p1363_bytes[0] == 0x30 {
        eprintln!("[ZCAM ERROR] sign_with_test_key: WARNING - Signature appears to be DER format!");
    } else {
        eprintln!("[ZCAM DEBUG] sign_with_test_key: Signature is in P1363 format (not DER)");
    }

    // Return the signature in P1363 format (raw r||s bytes).
    // This matches the format returned by Secure Enclave (X962/P1363) and avoids
    // triggering DER-to-P1363 conversion in c2pa-rs.
    Ok(p1363_bytes)
}
