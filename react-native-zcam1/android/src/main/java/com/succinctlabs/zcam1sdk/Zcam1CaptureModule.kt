package com.succinctlabs.zcam1sdk

import android.content.Intent
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule
import com.succinctlabs.zcam1sdk.camera.Zcam1CameraService
import java.io.File

@ReactModule(name = Zcam1CaptureModule.NAME)
class Zcam1CaptureModule(reactContext: ReactApplicationContext) :
    NativeZcam1CaptureSpec(reactContext) {

    companion object {
        const val NAME = "Zcam1Capture"
    }

    override fun getName(): String = NAME

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
        val service = Zcam1CameraService.activeInstance ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        service.takePhoto(format, flash, promise)
    }

    override fun startNativeVideoRecording(
        position: String,
        maxDurationSeconds: Double,
        promise: Promise
    ) {
        val service = Zcam1CameraService.activeInstance ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        service.startVideoRecording(maxDurationSeconds, promise)
    }

    override fun stopNativeVideoRecording(promise: Promise) {
        val service = Zcam1CameraService.activeInstance ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        service.stopVideoRecording(promise)
    }

    override fun setZoom(factor: Double) {
        Zcam1CameraService.activeInstance?.setZoom(factor.toFloat())
    }

    override fun setZoomAnimated(factor: Double) {
        Zcam1CameraService.activeInstance?.setZoomAnimated(factor.toFloat())
    }

    override fun getMinZoom(promise: Promise) {
        val service = Zcam1CameraService.activeInstance
        promise.resolve(service?.getMinZoom()?.toDouble() ?: 1.0)
    }

    override fun getMaxZoom(promise: Promise) {
        val service = Zcam1CameraService.activeInstance
        promise.resolve(service?.getMaxZoom()?.toDouble() ?: 1.0)
    }

    override fun getSwitchOverZoomFactors(promise: Promise) {
        // Android CameraX does not expose logical lens switch-over zoom factors
        promise.resolve(WritableNativeArray())
    }

    override fun hasUltraWideCamera(promise: Promise) {
        // Android does not distinguish ultra-wide in the same way as iOS
        promise.resolve(false)
    }

    override fun getExposureRange(promise: Promise) {
        val service = Zcam1CameraService.activeInstance
        val range = service?.getExposureRange() ?: Pair(-2.0f, 2.0f)
        val result = WritableNativeMap().apply {
            putDouble("min", range.first.toDouble())
            putDouble("max", range.second.toDouble())
        }
        promise.resolve(result)
    }

    override fun resetExposure() {
        Zcam1CameraService.activeInstance?.resetExposure()
    }

    override fun focusAtPoint(x: Double, y: Double) {
        Zcam1CameraService.activeInstance?.focusAtPoint(x.toFloat(), y.toFloat())
    }

    override fun getDeviceDiagnostics(promise: Promise) {
        val service = Zcam1CameraService.activeInstance ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        promise.resolve(service.getDeviceDiagnostics())
    }

    override fun isDepthSupported(promise: Promise) {
        // Depth delivery via CameraX is not exposed in a way that mirrors iOS AVDepthData
        promise.resolve(false)
    }

    override fun hasDepthZoomLimitations(promise: Promise) {
        promise.resolve(false)
    }

    override fun getDepthSupportedZoomRanges(promise: Promise) {
        promise.resolve(WritableNativeArray())
    }

    override fun previewFile(filePath: String, promise: Promise) {
        val context = reactApplicationContext
        val file = File(filePath)

        if (!file.exists()) {
            promise.reject("FILE_NOT_FOUND", "File does not exist: $filePath")
            return
        }

        try {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.provider",
                file
            )
            val ext = filePath.substringAfterLast('.', "").lowercase()
            val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "*/*"
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PREVIEW_ERROR", e.message, e)
        }
    }
}
