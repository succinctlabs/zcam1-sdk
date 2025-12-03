package com.zcam1prove

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = Zcam1ProveModule.NAME)
class Zcam1ProveModule(reactContext: ReactApplicationContext) :
  NativeZcam1ProveSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  // Example method
  // See https://reactnative.dev/docs/native-modules-android
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = "Zcam1Prove"
  }
}
