use der_parser::asn1_rs::{
    Any, Boolean, Class, Enumerated, FromDer, Integer, OctetString, Sequence,
};
use x509_cert::Certificate;

use crate::constants::KEY_ATTESTATION_OID_BYTES;
use crate::error::{Error, SecurityLevel};
use crate::types::{
    AttestationApplicationId, AuthorizationList, KeyDescription, PackageInfo, RootOfTrust,
    VerifiedBootState,
};

/// Extract and parse the Key Attestation extension from a certificate.
pub fn parse_key_description(cert: &Certificate) -> Result<KeyDescription, Error> {
    let extensions = cert
        .tbs_certificate
        .extensions
        .as_ref()
        .ok_or(Error::ExtensionNotFound)?;

    let mut extension_value: Option<&[u8]> = None;
    for ext in extensions {
        if ext.extn_id.as_bytes() == KEY_ATTESTATION_OID_BYTES {
            extension_value = Some(ext.extn_value.as_bytes());
            break;
        }
    }

    let ext_bytes = extension_value.ok_or(Error::ExtensionNotFound)?;
    parse_key_description_asn1(ext_bytes)
}

/// Parse a `KeyDescription` ASN.1 SEQUENCE from raw bytes.
///
/// ```asn1
/// KeyDescription ::= SEQUENCE {
///     attestationVersion         INTEGER,
///     attestationSecurityLevel   SecurityLevel (ENUMERATED),
///     keyMintVersion             INTEGER,
///     keyMintSecurityLevel       SecurityLevel (ENUMERATED),
///     attestationChallenge       OCTET STRING,
///     uniqueId                   OCTET STRING,
///     softwareEnforced           AuthorizationList (SEQUENCE),
///     hardwareEnforced           AuthorizationList (SEQUENCE),
/// }
/// ```
fn parse_key_description_asn1(bytes: &[u8]) -> Result<KeyDescription, Error> {
    let (_, seq) = Sequence::from_der(bytes).map_err(|e| err(format!("KeyDescription: {e}")))?;
    let data = seq.content.as_ref();

    // Field 1: attestationVersion (INTEGER)
    let (data, att_version) =
        Integer::from_der(data).map_err(|e| err(format!("attestationVersion: {e}")))?;

    // Field 2: attestationSecurityLevel (ENUMERATED)
    let (data, att_sec_level) =
        Enumerated::from_der(data).map_err(|e| err(format!("attestationSecurityLevel: {e}")))?;

    // Field 3: keyMintVersion (INTEGER)
    let (data, km_version) =
        Integer::from_der(data).map_err(|e| err(format!("keyMintVersion: {e}")))?;

    // Field 4: keyMintSecurityLevel (ENUMERATED)
    let (data, km_sec_level) =
        Enumerated::from_der(data).map_err(|e| err(format!("keyMintSecurityLevel: {e}")))?;

    // Field 5: attestationChallenge (OCTET STRING)
    let (data, att_challenge) =
        OctetString::from_der(data).map_err(|e| err(format!("attestationChallenge: {e}")))?;

    // Field 6: uniqueId (OCTET STRING)
    let (data, unique_id) =
        OctetString::from_der(data).map_err(|e| err(format!("uniqueId: {e}")))?;

    // Field 7: softwareEnforced (SEQUENCE = AuthorizationList)
    let (data, sw_seq) =
        Sequence::from_der(data).map_err(|e| err(format!("softwareEnforced: {e}")))?;

    // Field 8: hardwareEnforced (SEQUENCE = AuthorizationList)
    let (_, hw_seq) =
        Sequence::from_der(data).map_err(|e| err(format!("hardwareEnforced: {e}")))?;

    let attestation_security_level = security_level_from_enumerated(&att_sec_level)?;
    let keymint_security_level = security_level_from_enumerated(&km_sec_level)?;

    let software_enforced = parse_authorization_list(sw_seq.content.as_ref())?;
    let hardware_enforced = parse_authorization_list(hw_seq.content.as_ref())?;

    Ok(KeyDescription {
        attestation_version: integer_to_i64(&att_version)?,
        attestation_security_level,
        keymint_version: integer_to_i64(&km_version)?,
        keymint_security_level,
        attestation_challenge: att_challenge.as_ref().to_vec(),
        unique_id: unique_id.as_ref().to_vec(),
        software_enforced,
        hardware_enforced,
    })
}

/// Parse an `AuthorizationList` SEQUENCE by iterating EXPLICIT context-specific tags.
///
/// Each field is `[tag] EXPLICIT <type> OPTIONAL`.
/// We parse tags we need and skip unknown ones.
fn parse_authorization_list(data: &[u8]) -> Result<AuthorizationList, Error> {
    let mut auth_list = AuthorizationList::default();
    let mut remaining = data;

    while !remaining.is_empty() {
        let (rem, any) =
            Any::from_der(remaining).map_err(|e| err(format!("AuthorizationList element: {e}")))?;

        if any.header.class() == Class::ContextSpecific {
            let tag_num = any.header.tag().0;
            let inner = any.data;

            match tag_num {
                1 => auth_list.purpose = Some(parse_set_of_integer(inner)?),
                2 => auth_list.algorithm = Some(parse_inner_integer(inner)?),
                3 => auth_list.key_size = Some(parse_inner_integer(inner)?),
                5 => auth_list.digest = Some(parse_set_of_integer(inner)?),
                10 => auth_list.ec_curve = Some(parse_inner_integer(inner)?),
                701 => auth_list.creation_date_time = Some(parse_inner_integer(inner)?),
                702 => auth_list.origin = Some(parse_inner_integer(inner)?),
                704 => auth_list.root_of_trust = Some(parse_root_of_trust(inner)?),
                705 => auth_list.os_version = Some(parse_inner_integer(inner)?),
                706 => auth_list.os_patch_level = Some(parse_inner_integer(inner)?),
                709 => {
                    auth_list.attestation_application_id =
                        Some(parse_tag_709_application_id(inner)?);
                }
                718 => auth_list.vendor_patch_level = Some(parse_inner_integer(inner)?),
                719 => auth_list.boot_patch_level = Some(parse_inner_integer(inner)?),
                _ => { /* skip unknown tags */ }
            }
        }

        remaining = rem;
    }

    Ok(auth_list)
}

/// Parse the inner INTEGER from an EXPLICIT tagged value.
/// The `data` contains the full DER encoding of the inner INTEGER.
fn parse_inner_integer(data: &[u8]) -> Result<i64, Error> {
    let (_, int) = Integer::from_der(data).map_err(|e| err(format!("inner INTEGER: {e}")))?;
    integer_to_i64(&int)
}

/// Parse tag 704: RootOfTrust SEQUENCE from EXPLICIT tagged data.
///
/// ```asn1
/// RootOfTrust ::= SEQUENCE {
///     verifiedBootKey    OCTET STRING,
///     deviceLocked       BOOLEAN,
///     verifiedBootState  VerifiedBootState (ENUMERATED),
///     verifiedBootHash   OCTET STRING,   -- optional, present on attestation version >= 2
/// }
/// ```
fn parse_root_of_trust(data: &[u8]) -> Result<RootOfTrust, Error> {
    let (_, seq) =
        Sequence::from_der(data).map_err(|e| err(format!("RootOfTrust SEQUENCE: {e}")))?;
    let inner = seq.content.as_ref();

    // verifiedBootKey: OCTET STRING
    let (inner, boot_key) =
        OctetString::from_der(inner).map_err(|e| err(format!("verifiedBootKey: {e}")))?;

    // deviceLocked: BOOLEAN
    let (inner, locked) =
        Boolean::from_der(inner).map_err(|e| err(format!("deviceLocked: {e}")))?;

    // verifiedBootState: ENUMERATED
    let (inner, boot_state_enum) =
        Enumerated::from_der(inner).map_err(|e| err(format!("verifiedBootState: {e}")))?;

    let verified_boot_state = VerifiedBootState::from_i64(i64::from(boot_state_enum.0))
        .ok_or_else(|| err(format!("invalid VerifiedBootState: {}", boot_state_enum.0)))?;

    // verifiedBootHash: OCTET STRING (optional, may not be present on older attestation versions)
    let verified_boot_hash = if !inner.is_empty() {
        let (_, hash) =
            OctetString::from_der(inner).map_err(|e| err(format!("verifiedBootHash: {e}")))?;
        hash.as_ref().to_vec()
    } else {
        Vec::new()
    };

    Ok(RootOfTrust {
        verified_boot_key: boot_key.as_ref().to_vec(),
        device_locked: locked.bool(),
        verified_boot_state,
        verified_boot_hash,
    })
}

/// Parse a SET OF INTEGER from EXPLICIT tagged data.
fn parse_set_of_integer(data: &[u8]) -> Result<Vec<i64>, Error> {
    // The inner data starts with a SET tag wrapping multiple INTEGERs
    let (_, set_any) =
        Any::from_der(data).map_err(|e| err(format!("SET OF INTEGER outer: {e}")))?;

    let mut values = Vec::new();
    let mut inner = set_any.data;
    while !inner.is_empty() {
        let (rem, int) =
            Integer::from_der(inner).map_err(|e| err(format!("SET OF INTEGER element: {e}")))?;
        values.push(integer_to_i64(&int)?);
        inner = rem;
    }
    Ok(values)
}

/// Parse tag 709: attestationApplicationId.
///
/// The EXPLICIT tag wraps an OCTET STRING whose content is itself DER-encoded:
/// ```asn1
/// AttestationApplicationId ::= SEQUENCE {
///     package_infos     SET OF AttestationPackageInfo,
///     signature_digests SET OF OCTET STRING,
/// }
/// AttestationPackageInfo ::= SEQUENCE {
///     package_name OCTET STRING,
///     version      INTEGER,
/// }
/// ```
fn parse_tag_709_application_id(data: &[u8]) -> Result<AttestationApplicationId, Error> {
    // First layer: parse OCTET STRING
    let (_, octet) =
        OctetString::from_der(data).map_err(|e| err(format!("tag 709 OCTET STRING: {e}")))?;
    let inner_bytes = octet.as_ref();

    // Second layer: parse the SEQUENCE inside the OCTET STRING
    let (_, app_id_seq) = Sequence::from_der(inner_bytes)
        .map_err(|e| err(format!("AttestationApplicationId SEQUENCE: {e}")))?;
    let seq_data = app_id_seq.content.as_ref();

    // First element: SET OF AttestationPackageInfo
    let (seq_data, pkg_set) =
        Any::from_der(seq_data).map_err(|e| err(format!("package_infos SET: {e}")))?;

    let mut package_infos = Vec::new();
    let mut pkg_remaining = pkg_set.data;
    while !pkg_remaining.is_empty() {
        let (rem, pkg_info_seq) = Sequence::from_der(pkg_remaining)
            .map_err(|e| err(format!("AttestationPackageInfo: {e}")))?;
        let pkg_data = pkg_info_seq.content.as_ref();

        let (pkg_data, name_oct) =
            OctetString::from_der(pkg_data).map_err(|e| err(format!("package_name: {e}")))?;
        let (_, version_int) =
            Integer::from_der(pkg_data).map_err(|e| err(format!("package version: {e}")))?;

        let package_name = String::from_utf8(name_oct.as_ref().to_vec())
            .map_err(|e| err(format!("package_name UTF-8: {e}")))?;

        package_infos.push(PackageInfo {
            package_name,
            version: integer_to_i64(&version_int)?,
        });

        pkg_remaining = rem;
    }

    // Second element: SET OF OCTET STRING (signature digests)
    let mut signature_digests = Vec::new();
    if !seq_data.is_empty() {
        let (_, sig_set) =
            Any::from_der(seq_data).map_err(|e| err(format!("signature_digests SET: {e}")))?;

        let mut sig_remaining = sig_set.data;
        while !sig_remaining.is_empty() {
            let (rem, oct) = OctetString::from_der(sig_remaining)
                .map_err(|e| err(format!("signature digest: {e}")))?;
            signature_digests.push(oct.as_ref().to_vec());
            sig_remaining = rem;
        }
    }

    Ok(AttestationApplicationId {
        package_infos,
        signature_digests,
    })
}

/// Extract the first package name from a `KeyDescription`.
/// Checks `software_enforced` first (where Android typically places it),
/// then falls back to `hardware_enforced`.
pub fn extract_package_name(key_desc: &KeyDescription) -> Option<String> {
    key_desc
        .software_enforced
        .attestation_application_id
        .as_ref()
        .and_then(|app_id| app_id.package_infos.first())
        .map(|pkg| pkg.package_name.clone())
        .or_else(|| {
            key_desc
                .hardware_enforced
                .attestation_application_id
                .as_ref()
                .and_then(|app_id| app_id.package_infos.first())
                .map(|pkg| pkg.package_name.clone())
        })
}

fn security_level_from_enumerated(e: &Enumerated) -> Result<SecurityLevel, Error> {
    let val = i64::from(e.0);
    SecurityLevel::from_i64(val).ok_or_else(|| err(format!("invalid SecurityLevel value: {val}")))
}

fn integer_to_i64(int: &Integer) -> Result<i64, Error> {
    int.as_i64()
        .map_err(|e| err(format!("INTEGER to i64: {e}")))
}

fn err(msg: String) -> Error {
    Error::ExtensionParseError(msg)
}

#[cfg(test)]
mod tests {
    use super::*;
    use der_parser::asn1_rs::ToDer;

    /// Build a minimal KeyDescription DER blob for testing.
    fn build_test_key_description(
        challenge: &[u8],
        security_level: u32,
        package_name: Option<&str>,
    ) -> Vec<u8> {
        let mut inner = Vec::new();

        // attestationVersion: INTEGER 300
        append_integer(&mut inner, 300);
        // attestationSecurityLevel: ENUMERATED
        append_enumerated(&mut inner, security_level);
        // keyMintVersion: INTEGER 300
        append_integer(&mut inner, 300);
        // keyMintSecurityLevel: ENUMERATED
        append_enumerated(&mut inner, security_level);
        // attestationChallenge: OCTET STRING
        append_octet_string(&mut inner, challenge);
        // uniqueId: OCTET STRING (empty)
        append_octet_string(&mut inner, &[]);
        // softwareEnforced: AuthorizationList (SEQUENCE)
        let sw_auth = if let Some(name) = package_name {
            build_authorization_list_with_package(name)
        } else {
            // Empty SEQUENCE
            vec![0x30, 0x00]
        };
        inner.extend_from_slice(&sw_auth);
        // hardwareEnforced: AuthorizationList (empty SEQUENCE)
        inner.extend_from_slice(&[0x30, 0x00]);

        // Wrap in outer SEQUENCE
        wrap_sequence(&inner)
    }

    fn build_authorization_list_with_package(package_name: &str) -> Vec<u8> {
        // Build the AttestationApplicationId
        let app_id_inner = build_attestation_application_id(package_name);

        // Wrap in OCTET STRING
        let octet_string = wrap_octet_string(&app_id_inner);

        // Wrap in EXPLICIT tag [709]
        let tagged = wrap_explicit_tag(709, &octet_string);

        // Wrap in SEQUENCE (AuthorizationList)
        wrap_sequence(&tagged)
    }

    fn build_attestation_application_id(package_name: &str) -> Vec<u8> {
        // AttestationPackageInfo: SEQUENCE { OCTET STRING (name), INTEGER (version) }
        let mut pkg_info = Vec::new();
        append_octet_string(&mut pkg_info, package_name.as_bytes());
        append_integer(&mut pkg_info, 1);
        let pkg_info_seq = wrap_sequence(&pkg_info);

        // SET OF AttestationPackageInfo
        let pkg_set = wrap_set(&pkg_info_seq);

        // SET OF OCTET STRING (empty signature digests)
        let sig_set = wrap_set(&[]);

        // Wrap in SEQUENCE
        let mut content = Vec::new();
        content.extend_from_slice(&pkg_set);
        content.extend_from_slice(&sig_set);
        wrap_sequence(&content)
    }

    fn append_integer(buf: &mut Vec<u8>, value: i64) {
        let int = Integer::from(value);
        let _ = int.write_der(buf);
    }

    fn append_enumerated(buf: &mut Vec<u8>, value: u32) {
        let e = Enumerated(value);
        let _ = e.write_der(buf);
    }

    fn append_octet_string(buf: &mut Vec<u8>, data: &[u8]) {
        let oct = OctetString::new(data);
        let _ = oct.write_der(buf);
    }

    fn wrap_sequence(data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.push(0x30); // SEQUENCE tag
        encode_length(&mut buf, data.len());
        buf.extend_from_slice(data);
        buf
    }

    fn wrap_set(data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.push(0x31); // SET tag
        encode_length(&mut buf, data.len());
        buf.extend_from_slice(data);
        buf
    }

    fn wrap_octet_string(data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.push(0x04); // OCTET STRING tag
        encode_length(&mut buf, data.len());
        buf.extend_from_slice(data);
        buf
    }

    fn wrap_explicit_tag(tag_num: u32, data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        // CONTEXT-SPECIFIC | CONSTRUCTED (0xA0 base for short tags)
        if tag_num <= 30 {
            buf.push(0xA0 | tag_num as u8);
        } else {
            // Long form tag: first byte is 0xBF (context-specific | constructed | 0x1F)
            buf.push(0xBF);
            // Encode tag number in base-128
            let mut tag_bytes = Vec::new();
            let mut val = tag_num;
            tag_bytes.push((val & 0x7F) as u8);
            val >>= 7;
            while val > 0 {
                tag_bytes.push(((val & 0x7F) | 0x80) as u8);
                val >>= 7;
            }
            tag_bytes.reverse();
            buf.extend_from_slice(&tag_bytes);
        }
        encode_length(&mut buf, data.len());
        buf.extend_from_slice(data);
        buf
    }

    fn encode_length(buf: &mut Vec<u8>, len: usize) {
        if len < 128 {
            buf.push(len as u8);
        } else if len < 256 {
            buf.push(0x81);
            buf.push(len as u8);
        } else {
            buf.push(0x82);
            buf.push((len >> 8) as u8);
            buf.push(len as u8);
        }
    }

    #[test]
    fn test_parse_key_description_basic() {
        let challenge = b"test_challenge_123";
        let der = build_test_key_description(challenge, 1, None);

        let result = parse_key_description_asn1(&der);
        assert!(result.is_ok(), "parse failed: {result:?}");

        let kd = result.ok();
        assert!(kd.is_some());
        let kd = kd.as_ref();
        assert_eq!(
            kd.map(|k| &k.attestation_challenge[..]),
            Some(&challenge[..])
        );
        assert_eq!(
            kd.map(|k| k.attestation_security_level),
            Some(SecurityLevel::TrustedEnvironment)
        );
        assert_eq!(kd.map(|k| k.attestation_version), Some(300));
    }

    #[test]
    fn test_parse_key_description_with_package_name() {
        let challenge = b"device_key_abc";
        let der = build_test_key_description(challenge, 2, Some("com.anonymous.zcam1"));

        let result = parse_key_description_asn1(&der);
        assert!(result.is_ok(), "parse failed: {result:?}");

        let kd = result.ok();
        assert!(kd.is_some());
        let kd = kd.as_ref();
        assert_eq!(
            kd.map(|k| k.attestation_security_level),
            Some(SecurityLevel::StrongBox)
        );

        let pkg = kd.and_then(extract_package_name);
        assert_eq!(pkg.as_deref(), Some("com.anonymous.zcam1"));
    }

    #[test]
    fn test_parse_key_description_software_level() {
        let der = build_test_key_description(b"challenge", 0, None);
        let result = parse_key_description_asn1(&der);
        assert!(result.is_ok());
        let kd = result.ok();
        assert_eq!(
            kd.map(|k| k.attestation_security_level),
            Some(SecurityLevel::Software)
        );
    }

    #[test]
    fn test_parse_empty_authorization_list() {
        let result = parse_authorization_list(&[]);
        assert!(result.is_ok());
        let auth = result.ok();
        assert!(auth.as_ref().is_some_and(|a| a.purpose.is_none()));
        assert!(auth.as_ref().is_some_and(|a| a.algorithm.is_none()));
        assert!(auth.is_some_and(|a| a.attestation_application_id.is_none()));
    }

    #[test]
    fn test_extract_package_name_from_software_enforced() {
        let kd = KeyDescription {
            attestation_version: 300,
            attestation_security_level: SecurityLevel::TrustedEnvironment,
            keymint_version: 300,
            keymint_security_level: SecurityLevel::TrustedEnvironment,
            attestation_challenge: vec![],
            unique_id: vec![],
            software_enforced: AuthorizationList {
                attestation_application_id: Some(AttestationApplicationId {
                    package_infos: vec![PackageInfo {
                        package_name: "com.example.app".to_string(),
                        version: 1,
                    }],
                    signature_digests: vec![],
                }),
                ..AuthorizationList::default()
            },
            hardware_enforced: AuthorizationList::default(),
        };

        assert_eq!(
            extract_package_name(&kd),
            Some("com.example.app".to_string())
        );
    }

    #[test]
    fn test_extract_package_name_none() {
        let kd = KeyDescription {
            attestation_version: 300,
            attestation_security_level: SecurityLevel::TrustedEnvironment,
            keymint_version: 300,
            keymint_security_level: SecurityLevel::TrustedEnvironment,
            attestation_challenge: vec![],
            unique_id: vec![],
            software_enforced: AuthorizationList::default(),
            hardware_enforced: AuthorizationList::default(),
        };

        assert_eq!(extract_package_name(&kd), None);
    }

    #[test]
    fn test_parse_invalid_bytes() {
        let result = parse_key_description_asn1(&[0xFF, 0xFF]);
        assert!(result.is_err());
    }

    /// Build a RootOfTrust SEQUENCE for testing.
    fn build_root_of_trust(
        boot_key: &[u8],
        locked: bool,
        boot_state: u32,
        boot_hash: &[u8],
    ) -> Vec<u8> {
        let mut inner = Vec::new();
        append_octet_string(&mut inner, boot_key);
        // BOOLEAN: tag 0x01, length 0x01, value
        inner.push(0x01);
        inner.push(0x01);
        inner.push(if locked { 0xFF } else { 0x00 });
        // ENUMERATED: tag 0x0A, length 0x01, value
        append_enumerated(&mut inner, boot_state);
        append_octet_string(&mut inner, boot_hash);
        wrap_sequence(&inner)
    }

    /// Build an AuthorizationList containing specific tags for testing.
    fn build_authorization_list_with_tags(tags: &[(u32, Vec<u8>)]) -> Vec<u8> {
        let mut inner = Vec::new();
        for (tag_num, content) in tags {
            let tagged = wrap_explicit_tag(*tag_num, content);
            inner.extend_from_slice(&tagged);
        }
        wrap_sequence(&inner)
    }

    /// Build a DER INTEGER value (without explicit tag wrapping).
    fn build_integer_der(value: i64) -> Vec<u8> {
        let mut buf = Vec::new();
        append_integer(&mut buf, value);
        buf
    }

    #[test]
    fn test_parse_root_of_trust() {
        let boot_key = [0xAA; 32];
        let boot_hash = [0xBB; 32];
        let rot_bytes = build_root_of_trust(&boot_key, true, 0, &boot_hash);

        let result = parse_root_of_trust(&rot_bytes);
        assert!(result.is_ok(), "parse_root_of_trust failed: {result:?}");
        let rot = result.unwrap();

        assert_eq!(rot.verified_boot_key, boot_key);
        assert!(rot.device_locked);
        assert_eq!(rot.verified_boot_state, VerifiedBootState::Verified);
        assert!(rot.verified_boot_state.is_verified());
        assert_eq!(rot.verified_boot_hash, boot_hash);
    }

    #[test]
    fn test_parse_root_of_trust_unlocked() {
        let rot_bytes = build_root_of_trust(&[0x00; 32], false, 2, &[0x00; 32]);
        let rot = parse_root_of_trust(&rot_bytes).unwrap();

        assert!(!rot.device_locked);
        assert_eq!(rot.verified_boot_state, VerifiedBootState::Unverified);
        assert!(!rot.verified_boot_state.is_verified());
    }

    #[test]
    fn test_parse_authorization_list_new_tags() {
        let creation_time: i64 = 1_700_000_000_000; // ms since epoch
        let os_version: i64 = 140_000; // Android 14
        let os_patch: i64 = 202_601; // Jan 2026
        let vendor_patch: i64 = 20_260_115; // 2026-01-15
        let boot_patch: i64 = 20_260_105; // 2026-01-05

        let boot_key = [0xCC; 32];
        let boot_hash = [0xDD; 32];
        let rot_bytes = build_root_of_trust(&boot_key, true, 0, &boot_hash);

        let tags = vec![
            (701, build_integer_der(creation_time)),
            (704, rot_bytes),
            (705, build_integer_der(os_version)),
            (706, build_integer_der(os_patch)),
            (718, build_integer_der(vendor_patch)),
            (719, build_integer_der(boot_patch)),
        ];

        let auth_list_bytes = build_authorization_list_with_tags(&tags);
        // Parse just the inner content (strip the outer SEQUENCE wrapper)
        let (_, seq) = Sequence::from_der(&auth_list_bytes).unwrap();
        let result = parse_authorization_list(seq.content.as_ref());
        assert!(result.is_ok(), "parse failed: {result:?}");
        let auth = result.unwrap();

        assert_eq!(auth.creation_date_time, Some(creation_time));
        assert_eq!(auth.os_version, Some(os_version));
        assert_eq!(auth.os_patch_level, Some(os_patch));
        assert_eq!(auth.vendor_patch_level, Some(vendor_patch));
        assert_eq!(auth.boot_patch_level, Some(boot_patch));

        let rot = auth.root_of_trust.unwrap();
        assert_eq!(rot.verified_boot_key, boot_key);
        assert!(rot.device_locked);
        assert!(rot.verified_boot_state.is_verified());
        assert_eq!(rot.verified_boot_hash, boot_hash);
    }

    #[test]
    fn test_verified_boot_state_display() {
        assert_eq!(VerifiedBootState::Verified.to_string(), "Verified");
        assert_eq!(VerifiedBootState::SelfSigned.to_string(), "SelfSigned");
        assert_eq!(VerifiedBootState::Unverified.to_string(), "Unverified");
        assert_eq!(VerifiedBootState::Failed.to_string(), "Failed");
    }

    #[test]
    fn test_verified_boot_state_from_i64() {
        assert_eq!(
            VerifiedBootState::from_i64(0),
            Some(VerifiedBootState::Verified)
        );
        assert_eq!(
            VerifiedBootState::from_i64(1),
            Some(VerifiedBootState::SelfSigned)
        );
        assert_eq!(
            VerifiedBootState::from_i64(2),
            Some(VerifiedBootState::Unverified)
        );
        assert_eq!(
            VerifiedBootState::from_i64(3),
            Some(VerifiedBootState::Failed)
        );
        assert_eq!(VerifiedBootState::from_i64(99), None);
    }
}
