package com.succinctlabs.zcam1sdk

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.succinctlabs.zcam1sdk.camera.Zcam1CameraViewManager
import java.util.HashMap

class Zcam1CapturePackage : TurboReactPackage() {
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(Zcam1CameraViewManager())
  }
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == Zcam1CaptureModule.NAME) {
      Zcam1CaptureModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos[Zcam1CaptureModule.NAME] = ReactModuleInfo(
        Zcam1CaptureModule.NAME,
        Zcam1CaptureModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // isCxxModule
        true    // isTurboModule
      )
      moduleInfos
    }
  }
}
