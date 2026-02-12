package com.zcam1sdk

import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature

@ReactModule(name = Zcam1SdkModule.NAME)
class Zcam1SdkModule(reactContext: ReactApplicationContext) :
  NativeZcam1SdkSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  override fun signWithHardwareKey(keyTag: String, data: String, promise: Promise) {
    try {
      val keyStore = KeyStore.getInstance("AndroidKeyStore")
      keyStore.load(null)

      if (!keyStore.containsAlias(keyTag)) {
        promise.reject("KEY_NOT_FOUND", "No key found with alias: $keyTag")
        return
      }

      val privateKey = keyStore.getKey(keyTag, null) as? PrivateKey
        ?: return promise.reject("KEY_ERROR", "Could not retrieve private key")

      val signature = Signature.getInstance("SHA256withECDSA")
      signature.initSign(privateKey)
      signature.update(data.toByteArray(Charsets.UTF_8))

      promise.resolve(Base64.encodeToString(signature.sign(), Base64.NO_WRAP))
    } catch (e: Exception) {
      promise.reject("SIGN_ERROR", e.message, e)
    }
  }

  companion object {
    const val NAME = "Zcam1Sdk"
  }
}
