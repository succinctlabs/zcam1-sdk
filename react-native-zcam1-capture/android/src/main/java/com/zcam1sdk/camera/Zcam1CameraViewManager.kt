package com.zcam1sdk.camera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * ViewManager exposing Zcam1CameraView to React Native.
 * Props: cameraType ("front"|"back"), flashMode ("on"|"off"|"auto"), zoom (Float).
 */
class Zcam1CameraViewManager : SimpleViewManager<Zcam1CameraView>() {

    override fun getName(): String = "Zcam1CameraView"

    override fun createViewInstance(reactContext: ThemedReactContext): Zcam1CameraView {
        return Zcam1CameraView(reactContext)
    }

    @ReactProp(name = "cameraType")
    fun setCameraType(view: Zcam1CameraView, cameraType: String?) {
        view.cameraType = cameraType ?: "back"
    }

    @ReactProp(name = "flashMode")
    fun setFlashMode(view: Zcam1CameraView, flashMode: String?) {
        view.flashMode = flashMode ?: "off"
    }

    @ReactProp(name = "zoom", defaultFloat = 1.0f)
    fun setZoom(view: Zcam1CameraView, zoom: Float) {
        view.zoom = zoom
    }
}
