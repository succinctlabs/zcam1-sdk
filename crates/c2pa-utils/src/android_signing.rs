use jni::{
    objects::{JByteArray, JObject, JValue},
    JavaVM,
};
use std::error::Error;

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
    let result_bytes = env.convert_byte_array(JByteArray::from(result))?;

    Ok(result_bytes)
}
