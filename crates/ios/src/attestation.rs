use base64ct::{Base64, Encoding};
use bytes::Bytes;
use der_parser::parse_der;
use sha2::{Digest, Sha256};
use x509_cert::{
    Certificate,
    der::{DecodePem, asn1::OctetString},
};

use crate::{
    APPLE_ROOT_CERT,
    certificate::validate_certificate_path,
    error::Error,
    types::AttestationObject,
    utils::{b64_to_pem, decode_auth_data},
};

// Validate attestation object.
pub fn validate_attestation(
    attestation: AttestationObject,
    challenge: String,
    key_id: Vec<u8>,
    app_id: String,
    production: bool,
    leaf_cert_only: bool,
) -> Result<String, Error> {
    // 1. Verify certificate chain
    let mut cert_path = attestation.att_stmt.x5c.clone();
    cert_path.push(APPLE_ROOT_CERT.to_string());

    let cert_chain_valid: bool = validate_certificate_path(cert_path, leaf_cert_only);
    if !cert_chain_valid {
        return Err(Error::InvalidCertChain);
    }

    // 2. Create clientDataHash
    let mut hasher = Sha256::new();
    hasher.update(challenge);
    let client_data_hash: Vec<u8> = hasher.finalize().to_vec();

    let auth_data_decoded =
        Base64::decode_vec(&attestation.auth_data).map_err(Error::DecodeAuthDataFailed)?;

    // Concatenate auth_data_decoded and client_data_hash.
    let mut composite_data = auth_data_decoded;
    composite_data.extend(&client_data_hash);

    // 3. Generate nonce
    hasher = Sha256::new();
    hasher.update(composite_data);
    let expected_nonce = hasher.finalize();

    // 4. Obtain credential cert extension with OID 1.2.840.113635.100.8.2 and compare with nonce.
    let credential_certificate =
        Certificate::from_pem(b64_to_pem(&attestation.att_stmt.x5c[0]).as_bytes()).unwrap();

    let mut credential_cert_octets: Option<OctetString> = None;
    for extension in credential_certificate.tbs_certificate.extensions.unwrap() {
        // Check for the extension with OID 1.2.840.113635.100.8.2
        if extension.extn_id.as_bytes()
            == Bytes::from_static(&[42, 134, 72, 134, 247, 99, 100, 8, 2])
        {
            credential_cert_octets = Some(extension.extn_value);
            break;
        }
    }
    if let Some(credential_cert_octets) = credential_cert_octets {
        let cred_cert_octets_bytes = credential_cert_octets.into_bytes();
        let (_rem, seq) = parse_der(&cred_cert_octets_bytes)?;
        let content = &seq.content.as_sequence().unwrap()[0].content;

        // expect content to be variant Unknown(Any<'a>), get data from it
        match content {
            der_parser::der::DerObjectContent::Unknown(data) => {
                let (_new_rem, new_seq) = parse_der(data.data)?;
                match new_seq.content {
                    der_parser::der::DerObjectContent::OctetString(data) => {
                        if data != expected_nonce.to_vec() {
                            return Err(Error::NonceMismatch);
                        }
                    }
                    _ => return Err(Error::OctetStringExpected),
                }
            }
            _ => return Err(Error::UnknownContentExpected),
        }
    } else {
        return Err(Error::CredentialPublicKeyNotFound);
    }

    // 5. Get sha256 hash of the credential public key
    let credential_public_key = credential_certificate
        .tbs_certificate
        .subject_public_key_info
        .subject_public_key
        .raw_bytes();
    let mut hasher = Sha256::new();
    hasher.update(credential_public_key);
    let credential_public_key_hash = hasher.finalize();
    if credential_public_key_hash.to_vec() != key_id {
        panic!("Public key hash mismatch.");
    }

    // 6. Verify RP ID hash.
    // Note: We use app_id directly as the expected RP ID hash in base64 format,
    // rather than computing SHA-256(bundle_id), because Apple's App Attest RP ID
    // derivation is not straightforward to reverse-engineer from the bundle identifier.
    // The app_id parameter is now expected to be the base64-encoded RP ID hash.
    let expected_rp_id_hash =
        Base64::decode_vec(&app_id).map_err(|_| Error::InvalidAppId)?;
    let auth_data =
        decode_auth_data(Base64::decode_vec(&attestation.auth_data.clone().to_string()).unwrap())
            .expect("decoding error");
    if auth_data.rp_id != expected_rp_id_hash {
        return Err(Error::RpIdMismatch);
    }

    // 7. Verify counter
    if auth_data.counter > 0 {
        panic!("Counter must be 0.");
    }

    // 8. Very aaguid is present and is 16 bytes, if production \x61\x70\x70\x61\x74\x74\x65\x73\x74\x00\x00\x00\x00\x00\x00\x00 or appattestdevelop if dev
    match &auth_data.aaguid {
        Some(aaguid) => {
            if aaguid.len() != 16 {
                panic!("AAGUID must be 16 bytes.");
            }
            // check in bytes and in ASCII
            if production
                && (aaguid.as_slice()
                    != [
                        0x61, 0x70, 0x70, 0x61, 0x74, 0x74, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00,
                        0x00, 0x00, 0x00, 0x00,
                    ]
                    || aaguid.as_slice()
                        != [
                            97, 112, 112, 97, 116, 116, 101, 115, 116, 0, 0, 0, 0, 0, 0, 0,
                        ])
            {
                println!("aaguid: {:?}", aaguid.as_slice());
                panic!("AAGUID mismatch (prod).");
            }

            if !production
                && aaguid.as_slice()
                    != [
                        0x61, 0x70, 0x70, 0x61, 0x74, 0x74, 0x65, 0x73, 0x74, 0x64, 0x65, 0x76,
                        0x65, 0x6c, 0x6f, 0x70,
                    ]
            {
                println!("aaguid: {:?}", aaguid.as_slice());
                panic!("AAGUID mismatch (dev).");
            }
        }
        None => panic!("AAGUID not found."),
    }
    Ok(hex::encode(credential_public_key))
}
