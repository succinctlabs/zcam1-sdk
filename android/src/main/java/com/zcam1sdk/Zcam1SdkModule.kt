package com.zcam1sdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = Zcam1SdkModule.NAME)
class Zcam1SdkModule(reactContext: ReactApplicationContext) :
  NativeZcam1SdkSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  companion object {
    const val NAME = "Zcam1Sdk"
  }
}
