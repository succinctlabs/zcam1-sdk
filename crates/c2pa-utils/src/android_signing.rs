use jni::{
    objects::{JByteArray, JObject, JValue},
    JavaVM,
};
use std::error::Error;

/// Convert a DER-encoded ECDSA signature to raw IEEE P1363 format (r || s, 64 bytes).
///
/// Android KeyStore's `SHA256withECDSA` returns DER/ASN.1:
///   SEQUENCE { INTEGER r, INTEGER s }
/// c2pa's ES256 signer expects raw P1363: r (32 bytes) || s (32 bytes).
fn der_to_p1363(der: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    // DER SEQUENCE: 0x30 <len> 0x02 <r_len> <r_bytes> 0x02 <s_len> <s_bytes>
    if der.len() < 8 || der[0] != 0x30 || der[2] != 0x02 {
        return Err("Invalid DER signature: bad header".into());
    }
    let r_len = der[3] as usize;
    let r_start = 4;
    let r_end = r_start + r_len;
    if r_end + 2 > der.len() || der[r_end] != 0x02 {
        return Err("Invalid DER signature: bad r integer".into());
    }
    let s_len = der[r_end + 1] as usize;
    let s_start = r_end + 2;
    let s_end = s_start + s_len;
    if s_end > der.len() {
        return Err("Invalid DER signature: bad s integer".into());
    }

    let r_bytes = &der[r_start..r_end];
    let s_bytes = &der[s_start..s_end];

    // Strip leading zero padding (DER integers are signed, so a 0x00 prefix is
    // added when the high bit is set to keep the value positive).
    let r_bytes = r_bytes.strip_prefix(&[0x00]).unwrap_or(r_bytes);
    let s_bytes = s_bytes.strip_prefix(&[0x00]).unwrap_or(s_bytes);

    if r_bytes.len() > 32 || s_bytes.len() > 32 {
        return Err("DER signature integers too large for P-256".into());
    }

    let mut out = vec![0u8; 64];
    out[32 - r_bytes.len()..32].copy_from_slice(r_bytes);
    out[64 - s_bytes.len()..64].copy_from_slice(s_bytes);
    Ok(out)
}

/// Called by the Android runtime when the native library is loaded via
/// `System.loadLibrary`. Stores the JavaVM pointer so that background Rust
/// threads can attach to the JVM later (used by `sign_with_android_keystore`).
#[no_mangle]
pub unsafe extern "C" fn JNI_OnLoad(
    vm: *mut jni::sys::JavaVM,
    _reserved: *mut std::ffi::c_void,
) -> jni::sys::jint {
    ndk_context::initialize_android_context(vm.cast(), std::ptr::null_mut());
    jni::sys::JNI_VERSION_1_6
}

pub fn sign_with_android_keystore(key_alias: &str, data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    // Get the running JVM (already loaded by React Native / uniffi)
    let ctx = ndk_context::android_context();
    let jvm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("Failed to get JVM: {e}"))?;

    let mut env = jvm
        .attach_current_thread()
        .map_err(|e| format!("Failed to attach thread: {e}"))?;

    // KeyStore.getInstance("AndroidKeyStore")
    let ks_provider = env.new_string("AndroidKeyStore")?;
    let keystore = env
        .call_static_method(
            "java/security/KeyStore",
            "getInstance",
            "(Ljava/lang/String;)Ljava/security/KeyStore;",
            &[JValue::Object(&ks_provider.into())],
        )?
        .l()?;

    // keystore.load(null)
    env.call_method(
        &keystore,
        "load",
        "(Ljava/security/KeyStore$LoadStoreParameter;)V",
        &[JValue::Object(&JObject::null())],
    )?;

    // keystore.getKey(keyAlias, null) -> Key
    let alias_jstr = env.new_string(key_alias)?;
    let private_key = env
        .call_method(
            &keystore,
            "getKey",
            "(Ljava/lang/String;[C)Ljava/security/Key;",
            &[
                JValue::Object(&alias_jstr.into()),
                JValue::Object(&JObject::null()),
            ],
        )?
        .l()?;

    if private_key.is_null() {
        return Err(format!("Key not found in AndroidKeyStore with alias: {key_alias}").into());
    }

    // Signature.getInstance("SHA256withECDSA")
    let alg = env.new_string("SHA256withECDSA")?;
    let signature = env
        .call_static_method(
            "java/security/Signature",
            "getInstance",
            "(Ljava/lang/String;)Ljava/security/Signature;",
            &[JValue::Object(&alg.into())],
        )?
        .l()?;

    // signature.initSign(privateKey)
    env.call_method(
        &signature,
        "initSign",
        "(Ljava/security/PrivateKey;)V",
        &[JValue::Object(&private_key)],
    )?;

    // signature.update(data)
    let data_array = env.byte_array_from_slice(data)?;
    env.call_method(
        &signature,
        "update",
        "([B)V",
        &[JValue::Object(&data_array.into())],
    )?;

    // signature.sign() -> byte[]
    let result = env.call_method(&signature, "sign", "()[B", &[])?.l()?;
    let der_bytes = env.convert_byte_array(JByteArray::from(result))?;

    // Android KeyStore returns a DER-encoded ECDSA signature. c2pa's ES256
    // CallbackSigner expects raw IEEE P1363 format (r || s, 64 bytes).
    der_to_p1363(&der_bytes)
}
