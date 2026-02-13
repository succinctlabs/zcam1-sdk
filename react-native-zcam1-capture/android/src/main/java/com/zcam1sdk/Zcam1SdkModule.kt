package com.zcam1sdk

import com.facebook.fbreact.specs.NativeZcam1SdkSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = NativeZcam1SdkSpec.NAME)
class Zcam1SdkModule(reactContext: ReactApplicationContext) :
  NativeZcam1SdkSpec(reactContext) {

  // --- Photo Capture ---

  override fun takeNativePhoto(
    format: String,
    position: String,
    flash: String,
    includeDepthData: Boolean,
    aspectRatio: String,
    orientation: String,
    skipPostProcessing: Boolean,
    promise: Promise
  ) {
    promise.reject("NOT_IMPLEMENTED", "takeNativePhoto not implemented on Android yet")
  }

  // --- Video Recording ---

  override fun startNativeVideoRecording(
    position: String,
    maxDurationSeconds: Double,
    promise: Promise
  ) {
    promise.reject("NOT_IMPLEMENTED", "startNativeVideoRecording not implemented on Android yet")
  }

  override fun stopNativeVideoRecording(promise: Promise) {
    promise.reject("NOT_IMPLEMENTED", "stopNativeVideoRecording not implemented on Android yet")
  }

  // --- Zoom ---

  override fun setZoom(factor: Double) {
    // no-op stub
  }

  override fun setZoomAnimated(factor: Double) {
    // no-op stub
  }

  override fun getMinZoom(promise: Promise) {
    promise.resolve(1.0)
  }

  override fun getMaxZoom(promise: Promise) {
    promise.resolve(1.0)
  }

  override fun getSwitchOverZoomFactors(promise: Promise) {
    promise.resolve(Arguments.createArray())
  }

  override fun hasUltraWideCamera(promise: Promise) {
    promise.resolve(false)
  }

  // --- Exposure ---

  override fun getExposureRange(promise: Promise) {
    val map = Arguments.createMap()
    map.putDouble("min", 0.0)
    map.putDouble("max", 0.0)
    promise.resolve(map)
  }

  override fun resetExposure() {
    // no-op stub
  }

  // --- Focus ---

  override fun focusAtPoint(x: Double, y: Double) {
    // no-op stub
  }

  // --- Diagnostics ---

  override fun getDeviceDiagnostics(promise: Promise) {
    val map = Arguments.createMap()
    map.putString("deviceType", "android-stub")
    map.putDouble("minZoom", 1.0)
    map.putDouble("maxZoom", 1.0)
    map.putDouble("currentZoom", 1.0)
    map.putArray("switchOverFactors", Arguments.createArray())
    map.putDouble("switchingBehavior", 0.0)
    map.putBoolean("isVirtualDevice", false)
    map.putDouble("currentExposureBias", 0.0)
    map.putDouble("minExposureBias", 0.0)
    map.putDouble("maxExposureBias", 0.0)
    map.putDouble("currentISO", 0.0)
    map.putDouble("exposureDuration", 0.0)
    promise.resolve(map)
  }

  // --- Depth ---

  override fun isDepthSupported(promise: Promise) {
    promise.resolve(false)
  }

  override fun hasDepthZoomLimitations(promise: Promise) {
    promise.resolve(false)
  }

  override fun getDepthSupportedZoomRanges(promise: Promise) {
    promise.resolve(Arguments.createArray())
  }

  // --- File Preview ---

  override fun previewFile(filePath: String, promise: Promise) {
    promise.reject("NOT_IMPLEMENTED", "previewFile not implemented on Android yet")
  }
}
