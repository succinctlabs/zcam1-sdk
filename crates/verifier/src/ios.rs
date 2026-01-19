use base64ct::{Base64, Encoding};
use sp1_verifier::GROTH16_VK_BYTES;
use zcam1_c2pa_utils::{compute_hash, extract_manifest};

use crate::error::Error;

const APPLE_ROOT_CERT: &str = "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";

/// Verifies a cryptographic proof embedded in a C2PA manifest.
///
/// This function extracts the active manifest from the file at the given path,
/// retrieves the embedded proof, and verifies it using the Groth16 verifier.
/// The public inputs for verification include the manifest's data hash and the
/// Apple root certificate.
///
/// # Arguments
///
/// * `path` - A string slice that holds the path to the file containing the C2PA manifest
///
/// # Returns
///
/// * `Ok(true)` if the proof verification succeeds
/// * `Err(Error)` if the manifest cannot be extracted, the proof is not found, or verification fails
pub fn verify_proof(path: &str) -> Result<bool, Error> {
    let store = extract_manifest(path)?;
    let mut hash = compute_hash(path)?;
    let active_manifest = store.active_manifest()?;
    let proof = active_manifest
        .proof()
        .ok_or_else(|| Error::ProofNotFound)?;
    let mut public_inputs = vec![];

    public_inputs.append(&mut hash);
    public_inputs.append(&mut APPLE_ROOT_CERT.as_bytes().to_vec());

    sp1_verifier::Groth16Verifier::verify(
        &Base64::decode_vec(&proof.data)?,
        &public_inputs,
        &proof.vk_hash,
        *GROTH16_VK_BYTES,
    )?;

    Ok(true)
}
