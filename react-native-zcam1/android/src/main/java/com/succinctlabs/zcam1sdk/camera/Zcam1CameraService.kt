package com.succinctlabs.zcam1sdk.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.media.MediaMetadataRetriever
import android.os.Build
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random
import androidx.exifinterface.media.ExifInterface
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.video.VideoCapture
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.util.concurrent.Executor

/**
 * Core camera service managing CameraX lifecycle, photo capture, video recording,
 * zoom, flash, focus, and exposure. Created per camera view instance.
 */
class Zcam1CameraService {

    companion object {
        private const val TAG = "Zcam1CameraService"
        private const val MAX_ZOOM_CAP = 20.0f

        /**
         * Active instance used by Zcam1CaptureModule to delegate camera methods.
         * Set when a Zcam1CameraView starts its camera, cleared when it stops.
         */
        @Volatile
        var activeInstance: Zcam1CameraService? = null
            private set
    }

    private var camera: Camera? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var preview: Preview? = null

    private var currentLensFacing = CameraUtils.LENS_FACING_BACK
    private var currentFlashMode = CameraUtils.FLASH_OFF
    private var currentZoom = 1.0f

    private var lifecycleOwner: LifecycleOwner? = null
    private var surfaceProvider: Preview.SurfaceProvider? = null
    private var executor: Executor? = null
    private var context: Context? = null

    // Video recording state
    private var activeRecording: Recording? = null
    private var recordingOutputFile: File? = null
    private var stopRecordingPromise: Promise? = null
    private var recordingHasAudio: Boolean = false

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
        this.context = context
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
        activeRecording?.stop()
        activeRecording = null
        cameraProvider?.unbindAll()
        camera = null
        imageCapture = null
        videoCapture = null
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

        val recorder = Recorder.Builder()
            .setQualitySelector(QualitySelector.from(Quality.HIGHEST))
            .build()
        videoCapture = VideoCapture.withOutput(recorder)

        try {
            camera = provider.bindToLifecycle(owner, cameraSelector, preview, imageCapture, videoCapture)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to bind with VideoCapture, retrying without it: ${e.message}")
            videoCapture = null
            try {
                camera = provider.bindToLifecycle(owner, cameraSelector, preview, imageCapture)
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to bind camera use cases", e2)
                return
            }
        }
        if (currentZoom != 1.0f) {
            setZoom(currentZoom)
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

    fun setZoomAnimated(factor: Float) {
        // CameraX doesn't have a built-in smooth ramp like AVFoundation; use linear zoom for smooth transitions
        val cam = camera ?: return
        val zoomState = cam.cameraInfo.zoomState.value ?: return
        val minZoom = zoomState.minZoomRatio
        val maxZoom = minOf(zoomState.maxZoomRatio, MAX_ZOOM_CAP)
        val clamped = factor.coerceIn(minZoom, maxZoom)
        val linearZoom = if (maxZoom > minZoom) (clamped - minZoom) / (maxZoom - minZoom) else 0f
        cam.cameraControl.setLinearZoom(linearZoom)
        currentZoom = clamped
    }

    fun setFlashMode(mode: String) {
        currentFlashMode = CameraUtils.mapFlashMode(mode)
        imageCapture?.flashMode = currentFlashMode
    }

    fun getMinZoom(): Float {
        return camera?.cameraInfo?.zoomState?.value?.minZoomRatio ?: 1.0f
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

    // === Exposure ===

    fun getExposureRange(): Pair<Float, Float> {
        val state = camera?.cameraInfo?.exposureState ?: return Pair(-2.0f, 2.0f)
        val range = state.exposureCompensationRange
        val step = state.exposureCompensationStep.toFloat()
        return Pair(range.lower * step, range.upper * step)
    }

    fun resetExposure() {
        camera?.cameraControl?.setExposureCompensationIndex(0)
    }

    // === Emulator Helpers ===

    private fun isEmulator(): Boolean {

        return (Build.HARDWARE == "goldfish"
                || Build.HARDWARE == "ranchu"
                || Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.contains("emulator")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for")
                || Build.MANUFACTURER.contains("Genymotion")
                || Build.BRAND.startsWith("generic")
                || Build.DEVICE.startsWith("generic"))
    }

    private fun createTestImage(): Bitmap {
        val width = 1920
        val height = 1080
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val rng = Random.Default
        val hue = rng.nextFloat() * 360f
        val saturation = 0.55f + rng.nextFloat() * 0.35f
        val brightness1 = 0.5f + rng.nextFloat() * 0.25f
        val brightness2 = (brightness1 + 0.15f + rng.nextFloat() * 0.2f).coerceAtMost(1.0f)

        val color1 = Color.HSVToColor(floatArrayOf(hue, saturation, brightness1))
        val color2 = Color.HSVToColor(floatArrayOf(hue, saturation, brightness2))

        val gradientPaint = Paint()
        gradientPaint.shader = LinearGradient(
            0f, 0f, width.toFloat(), height.toFloat(),
            color1, color2, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), gradientPaint)

        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(230, 255, 255, 255)
            textSize = 96f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        val label = "EMULATOR TEST IMAGE"
        canvas.drawText(label, width / 2f, height / 2f - 60f, textPaint)

        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(230, 255, 255, 255)
            textSize = 72f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            textAlign = Paint.Align.CENTER
        }
        val dateStr = SimpleDateFormat("yyyy-MM-dd  HH:mm:ss", Locale.US).format(Date())
        canvas.drawText(dateStr, width / 2f, height / 2f + 80f, datePaint)

        return bitmap
    }

    // === Photo Capture ===

    /**
     * Capture a photo and resolve the promise with path and format.
     * The returned temp file is owned by the caller.
     */
    fun takePhoto(format: String, flash: String, promise: Promise) {
        if (format == "dng") {
            promise.reject("UNSUPPORTED_FORMAT", "DNG format is not supported on Android")
            return
        }

        if (isEmulator()) {
            try {
                val bitmap = createTestImage()
                val tempFile = File.createTempFile("zcam1_emulator_", ".jpg")
                tempFile.outputStream().use { out ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                }
                bitmap.recycle()

                val dateStr = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).format(Date())
                val exif = WritableNativeMap().apply {
                    putArray("ISOSpeedRatings", WritableNativeArray())
                    putInt("PixelXDimension", 1920)
                    putInt("PixelYDimension", 1080)
                    putDouble("ExposureTime", 0.0)
                    putDouble("FNumber", 1.0)
                    putDouble("FocalLength", 5.0)
                }
                val tiff = WritableNativeMap().apply {
                    putString("DateTime", dateStr)
                    putString("Make", "Android")
                    putString("Model", "Android Emulator")
                    putString("Software", "Android Emulator")
                }
                val metadata = WritableNativeMap().apply {
                    putMap("{Exif}", exif)
                    putMap("{TIFF}", tiff)
                    putInt("Orientation", 1)
                }
                val result = WritableNativeMap().apply {
                    putString("filePath", tempFile.absolutePath)
                    putString("format", "jpeg")
                    putMap("metadata", metadata)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("CAPTURE_ERROR", "Failed to create emulator test image: ${e.message}", e)
            }
            return
        }

        if (camera == null) {
            promise.reject(
                "CAMERA_ERROR",
                "Camera not bound — check that the device has a camera and permissions are granted"
            )
            return
        }

        val capture = imageCapture ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        val exec = executor ?: run {
            promise.reject("CAMERA_ERROR", "Executor not available")
            return
        }

        capture.flashMode = CameraUtils.mapFlashMode(flash)
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
                    val exifData = try {
                        val exifInterface = ExifInterface(tempFile.absolutePath)
                        val exifMap = WritableNativeMap().apply {
                            val width = exifInterface.getAttributeInt(ExifInterface.TAG_IMAGE_WIDTH, 0)
                            val height = exifInterface.getAttributeInt(ExifInterface.TAG_IMAGE_LENGTH, 0)
                            if (width > 0) putInt("PixelXDimension", width)
                            if (height > 0) putInt("PixelYDimension", height)
                            exifInterface.getAttributeDouble(ExifInterface.TAG_EXPOSURE_TIME, Double.NaN)
                                .takeIf { !it.isNaN() }?.let { putDouble("ExposureTime", it) }
                            exifInterface.getAttributeDouble(ExifInterface.TAG_F_NUMBER, Double.NaN)
                                .takeIf { !it.isNaN() }?.let { putDouble("FNumber", it) }
                            exifInterface.getAttributeDouble(ExifInterface.TAG_FOCAL_LENGTH, Double.NaN)
                                .takeIf { !it.isNaN() }?.let { putDouble("FocalLength", it) }
                            exifInterface.getAttribute(ExifInterface.TAG_ISO_SPEED_RATINGS)
                                ?.let { putString("ISOSpeedRatings", it) }
                        }
                        val tiffMap = WritableNativeMap().apply {
                            exifInterface.getAttribute(ExifInterface.TAG_DATETIME)
                                ?.let { putString("DateTime", it) }
                            exifInterface.getAttribute(ExifInterface.TAG_MAKE)
                                ?.let { putString("Make", it) }
                            exifInterface.getAttribute(ExifInterface.TAG_MODEL)
                                ?.let { putString("Model", it) }
                            exifInterface.getAttribute(ExifInterface.TAG_SOFTWARE)
                                ?.let { putString("Software", it) }
                        }
                        val orientation = exifInterface.getAttributeInt(
                            ExifInterface.TAG_ORIENTATION,
                            ExifInterface.ORIENTATION_NORMAL
                        )
                        WritableNativeMap().apply {
                            putMap("{Exif}", exifMap)
                            putMap("{TIFF}", tiffMap)
                            putInt("Orientation", orientation)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to read EXIF from captured image", e)
                        null
                    }

                    val result = WritableNativeMap().apply {
                        putString("filePath", tempFile.absolutePath)
                        putString("format", "jpeg")
                        if (exifData != null) putMap("metadata", exifData) else putNull("metadata")
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

    // === Video Recording ===

    fun startVideoRecording(maxDurationSeconds: Double, promise: Promise) {
        val vc = videoCapture ?: run {
            promise.reject("CAMERA_ERROR", "Camera not initialized")
            return
        }
        val ctx = context ?: run {
            promise.reject("CAMERA_ERROR", "Context not available")
            return
        }
        val exec = executor ?: run {
            promise.reject("CAMERA_ERROR", "Executor not available")
            return
        }

        if (activeRecording != null) {
            promise.reject("RECORDING_ERROR", "A recording is already in progress")
            return
        }

        val hasAudio = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        recordingHasAudio = hasAudio

        val outputFile = File.createTempFile("zcam1_video_", ".mp4")
        recordingOutputFile = outputFile

        val outputOptions = FileOutputOptions.Builder(outputFile).apply {
            if (maxDurationSeconds > 0) {
                setDurationLimitMillis((maxDurationSeconds * 1000).toLong())
            }
        }.build()

        var pendingRecording = vc.output.prepareRecording(ctx, outputOptions)
        if (hasAudio) {
            pendingRecording = pendingRecording.withAudioEnabled()
        }

        activeRecording = pendingRecording.start(exec) { event ->
            when (event) {
                is VideoRecordEvent.Finalize -> {
                    val stopPromise = stopRecordingPromise
                    stopRecordingPromise = null
                    activeRecording = null

                    if (event.hasError()) {
                        Log.e(TAG, "Video recording finalized with error: ${event.error}")
                        outputFile.delete()
                        stopPromise?.reject("RECORDING_ERROR", "Recording failed: ${event.error}")
                    } else {
                        stopPromise?.resolve(buildStopResult(outputFile, hasAudio))
                    }
                }

                else -> { /* ignore Start, Status events */
                }
            }
        }

        val startResult = WritableNativeMap().apply {
            putString("status", "recording")
            putString("filePath", outputFile.absolutePath)
            putString("format", "mov")
            putBoolean("hasAudio", hasAudio)
        }
        promise.resolve(startResult)
    }

    fun stopVideoRecording(promise: Promise) {
        val recording = activeRecording ?: run {
            promise.reject("RECORDING_ERROR", "No active recording")
            return
        }
        stopRecordingPromise = promise
        recording.stop()
    }

    private fun buildStopResult(outputFile: File, hasAudio: Boolean): WritableNativeMap {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(outputFile.absolutePath)

            val durationMs =
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
            val rotation =
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            val frameRate =
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toDoubleOrNull()
                    ?: 0.0

            return WritableNativeMap().apply {
                putString("filePath", outputFile.absolutePath)
                putString("format", "mov")
                putBoolean("hasAudio", hasAudio)
                putString("deviceMake", Build.MANUFACTURER)
                putString("deviceModel", Build.MODEL)
                putString("softwareVersion", Build.VERSION.RELEASE)
                putDouble("durationSeconds", durationMs / 1000.0)
                putDouble("fileSizeBytes", outputFile.length().toDouble())
                putInt("width", width)
                putInt("height", height)
                putInt("rotationDegrees", rotation)
                putDouble("frameRate", frameRate)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to extract video metadata", e)
            return WritableNativeMap().apply {
                putString("filePath", outputFile.absolutePath)
                putString("format", "mov")
                putBoolean("hasAudio", hasAudio)
                putString("deviceMake", Build.MANUFACTURER)
                putString("deviceModel", Build.MODEL)
                putString("softwareVersion", Build.VERSION.RELEASE)
                putDouble("durationSeconds", 0.0)
                putDouble("fileSizeBytes", outputFile.length().toDouble())
                putInt("width", 0)
                putInt("height", 0)
                putInt("rotationDegrees", 0)
                putDouble("frameRate", 0.0)
            }
        } finally {
            retriever.release()
        }
    }

    // === Diagnostics ===

    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    fun getDeviceDiagnostics(): WritableNativeMap {
        val cam = camera
        val zoomState = cam?.cameraInfo?.zoomState?.value
        val exposureState = cam?.cameraInfo?.exposureState

        val minZoom = zoomState?.minZoomRatio?.toDouble() ?: 1.0
        val maxZoom = minOf(zoomState?.maxZoomRatio ?: 1.0f, MAX_ZOOM_CAP).toDouble()
        val currentZoomVal = zoomState?.zoomRatio?.toDouble() ?: currentZoom.toDouble()

        val expStep = exposureState?.exposureCompensationStep?.toFloat() ?: 1.0f
        val expRange = exposureState?.exposureCompensationRange
        val minExpBias = (expRange?.lower ?: -2) * expStep
        val maxExpBias = (expRange?.upper ?: 2) * expStep
        val currentExpIndex = exposureState?.exposureCompensationIndex ?: 0
        val currentExpBias = currentExpIndex * expStep

        return WritableNativeMap().apply {
            putString("deviceType", "builtInCamera")
            putDouble("minZoom", minZoom)
            putDouble("maxZoom", maxZoom)
            putDouble("currentZoom", currentZoomVal)
            putArray("switchOverFactors", WritableNativeArray())
            putInt("switchingBehavior", 0)
            putBoolean("isVirtualDevice", false)
            putDouble("currentExposureBias", currentExpBias.toDouble())
            putDouble("minExposureBias", minExpBias.toDouble())
            putDouble("maxExposureBias", maxExpBias.toDouble())
            putDouble("currentISO", 0.0)
            putDouble("exposureDuration", 0.0)
        }
    }
}
