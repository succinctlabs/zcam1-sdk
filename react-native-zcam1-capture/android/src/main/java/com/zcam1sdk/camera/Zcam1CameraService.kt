package com.zcam1sdk.camera

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.util.concurrent.Executor

/**
 * Core camera service managing CameraX lifecycle, photo capture,
 * zoom, flash, and focus. Created per camera view instance.
 */
class Zcam1CameraService {

    companion object {
        private const val TAG = "Zcam1CameraService"
        private const val MAX_ZOOM_CAP = 20.0f

        /**
         * Active instance used by Zcam1SdkModule to delegate camera methods.
         * Set when a Zcam1CameraView starts its camera, cleared when it stops.
         */
        @Volatile
        var activeInstance: Zcam1CameraService? = null
            private set
    }

    private var camera: Camera? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var preview: Preview? = null

    private var currentLensFacing = CameraUtils.LENS_FACING_BACK
    private var currentFlashMode = CameraUtils.FLASH_OFF
    private var currentZoom = 1.0f

    private var lifecycleOwner: LifecycleOwner? = null
    private var surfaceProvider: Preview.SurfaceProvider? = null
    private var executor: Executor? = null

    /**
     * Start camera preview and capture pipeline.
     */
    fun startCamera(
        context: Context,
        lifecycleOwner: LifecycleOwner,
        surfaceProvider: Preview.SurfaceProvider,
        lensFacing: String = "back",
        flashMode: String = "off"
    ) {
        this.lifecycleOwner = lifecycleOwner
        this.surfaceProvider = surfaceProvider
        this.executor = ContextCompat.getMainExecutor(context)
        this.currentLensFacing = CameraUtils.mapLensFacing(lensFacing)
        this.currentFlashMode = CameraUtils.mapFlashMode(flashMode)

        activeInstance = this

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCameraUseCases()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get camera provider", e)
            }
        }, executor!!)
    }

    /**
     * Stop camera and release resources.
     */
    fun stopCamera() {
        cameraProvider?.unbindAll()
        camera = null
        imageCapture = null
        preview = null
        if (activeInstance == this) {
            activeInstance = null
        }
    }

    private fun bindCameraUseCases() {
        val provider = cameraProvider ?: return
        val owner = lifecycleOwner ?: return
        val surface = surfaceProvider ?: return

        provider.unbindAll()

        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(currentLensFacing)
            .build()

        preview = Preview.Builder()
            .build()
            .also { it.setSurfaceProvider(surface) }

        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .setFlashMode(currentFlashMode)
            .build()

        try {
            camera = provider.bindToLifecycle(owner, cameraSelector, preview, imageCapture)
            if (currentZoom != 1.0f) {
                setZoom(currentZoom)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind camera use cases", e)
        }
    }

    // === Camera Controls ===

    fun setZoom(factor: Float) {
        val cam = camera ?: return
        val maxZoom = cam.cameraInfo.zoomState.value?.maxZoomRatio ?: 1.0f
        val cappedMax = minOf(maxZoom, MAX_ZOOM_CAP)
        currentZoom = CameraUtils.clampZoom(factor, cappedMax)
        cam.cameraControl.setZoomRatio(currentZoom)
    }

    fun setFlashMode(mode: String) {
        currentFlashMode = CameraUtils.mapFlashMode(mode)
        imageCapture?.flashMode = currentFlashMode
    }

    fun getMaxZoom(): Float {
        val cam = camera ?: return 1.0f
        val maxZoom = cam.cameraInfo.zoomState.value?.maxZoomRatio ?: 1.0f
        return minOf(maxZoom, MAX_ZOOM_CAP)
    }

    fun focusAtPoint(x: Float, y: Float) {
        val cam = camera ?: return

        val factory = SurfaceOrientedMeteringPointFactory(1.0f, 1.0f)
        val point = factory.createPoint(x, y)
        val action = FocusMeteringAction.Builder(point).build()

        cam.cameraControl.startFocusAndMetering(action)
    }

    // === Photo Capture ===

    /**
     * Capture a photo and resolve the promise with path, dimensions, orientation, timestamp.
     * The returned temp file is owned by the caller — the caller is responsible for
     * deleting it when no longer needed (e.g. after C2PA embedding or upload).
     */
    fun takePhoto(flash: String, promise: Promise) {
        val capture = imageCapture ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        val exec = executor ?: run {
            promise.reject("CAMERA_ERROR", "Executor not available")
            return
        }

        // Apply flash override for this capture
        capture.flashMode = CameraUtils.mapFlashMode(flash)

        // Set target rotation based on current orientation
        capture.targetRotation = when (Zcam1OrientationManager.currentOrientation()) {
            90 -> android.view.Surface.ROTATION_90
            180 -> android.view.Surface.ROTATION_180
            270 -> android.view.Surface.ROTATION_270
            else -> android.view.Surface.ROTATION_0
        }

        val tempFile = File.createTempFile("zcam1_", ".jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(tempFile).build()

        capture.takePicture(
            outputOptions,
            exec,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val orientation = Zcam1OrientationManager.currentOrientation()

                    // Read dimensions via BitmapFactory (single I/O pass, always reliable)
                    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeFile(tempFile.absolutePath, opts)
                    val width = opts.outWidth
                    val height = opts.outHeight

                    val result = WritableNativeMap().apply {
                        putString("filePath", tempFile.absolutePath)
                        putString("format", "jpeg")
                        putInt("width", width)
                        putInt("height", height)
                        putInt("orientation", orientation)
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }
                    promise.resolve(result)
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed", exception)
                    tempFile.delete()
                    promise.reject("CAPTURE_ERROR", exception.message, exception)
                }
            }
        )
    }
}
