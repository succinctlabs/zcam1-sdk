# Task 03: Kotlin Camera Implementation

## Overview

Implement native Android camera capture functionality in `react-native-zcam1-capture` using Camera2 API or CameraX. This mirrors the iOS `Zcam1Camera.swift` implementation.

**Estimated complexity:** Medium-High

**Dependencies:**
- Task 01 (attestation) should be complete for signing integration
- Can start in parallel if interfaces are agreed upon

---

## Background Context

### Current iOS Implementation

The iOS camera implementation in `ios/Zcam1Camera.swift` provides:
- Camera preview with AVFoundation
- Photo capture with metadata
- Video recording
- Depth data capture (dual/triple camera)
- Motion detection for orientation
- Film style filters (via Harbeth library)
- Focus, zoom, exposure controls

### Android Equivalent

We'll use **CameraX** (recommended) or **Camera2** for similar functionality:
- CameraX is simpler and handles device compatibility
- Camera2 gives more control but requires more code

---

## Implementation Steps

### Step 1: Add Dependencies

**File:** `react-native-zcam1-capture/android/build.gradle`

```groovy
dependencies {
    // Existing dependencies...

    // CameraX
    def camerax_version = "1.3.1"
    implementation "androidx.camera:camera-core:$camerax_version"
    implementation "androidx.camera:camera-camera2:$camerax_version"
    implementation "androidx.camera:camera-lifecycle:$camerax_version"
    implementation "androidx.camera:camera-view:$camerax_version"

    // For EXIF metadata
    implementation "androidx.exifinterface:exifinterface:1.3.7"

    // Coroutines for async operations
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"

    // Play Integrity (from Task 01)
    implementation "com.google.android.play:integrity:1.3.0"
}
```

### Step 2: Create Camera Service

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/camera/Zcam1CameraService.kt`

```kotlin
package com.zcam1sdk.camera

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs

class Zcam1CameraService(private val context: Context) : SensorEventListener {

    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var preview: Preview? = null
    private var camera: Camera? = null

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    // Orientation detection (matches iOS 0.75g threshold)
    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var currentOrientation: Int = 0 // 0, 90, 180, 270

    companion object {
        private const val TAG = "Zcam1CameraService"
        private const val GRAVITY_THRESHOLD = 0.75f * 9.81f
    }

    // Current camera settings
    private var lensFacing: Int = CameraSelector.LENS_FACING_BACK
    private var flashMode: Int = ImageCapture.FLASH_MODE_OFF

    init {
        setupOrientationSensor()
    }

    private fun setupOrientationSensor() {
        sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        accelerometer?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            val x = it.values[0]
            val y = it.values[1]

            currentOrientation = when {
                abs(x) > GRAVITY_THRESHOLD && x > 0 -> 90   // Landscape left
                abs(x) > GRAVITY_THRESHOLD && x < 0 -> 270 // Landscape right
                abs(y) > GRAVITY_THRESHOLD && y < 0 -> 180 // Upside down
                else -> 0 // Portrait
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    suspend fun startCamera(
        previewView: PreviewView,
        lifecycleOwner: LifecycleOwner
    ) = suspendCancellableCoroutine<Unit> { continuation ->
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()

                // Preview use case
                preview = Preview.Builder()
                    .setTargetRotation(previewView.display.rotation)
                    .build()
                    .also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                // Image capture use case
                imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .setFlashMode(flashMode)
                    .setTargetRotation(previewView.display.rotation)
                    .build()

                // Select camera
                val cameraSelector = CameraSelector.Builder()
                    .requireLensFacing(lensFacing)
                    .build()

                // Unbind previous use cases
                cameraProvider?.unbindAll()

                // Bind use cases to camera
                camera = cameraProvider?.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageCapture
                )

                continuation.resume(Unit)
            } catch (e: Exception) {
                Log.e(TAG, "Camera start failed", e)
                continuation.resumeWithException(e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    suspend fun takePhoto(outputFile: File): PhotoResult = suspendCancellableCoroutine { continuation ->
        val imageCapture = imageCapture ?: run {
            continuation.resumeWithException(IllegalStateException("Camera not initialized"))
            return@suspendCancellableCoroutine
        }

        // Update rotation based on sensor
        imageCapture.targetRotation = when (currentOrientation) {
            90 -> android.view.Surface.ROTATION_90
            180 -> android.view.Surface.ROTATION_180
            270 -> android.view.Surface.ROTATION_270
            else -> android.view.Surface.ROTATION_0
        }

        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()

        imageCapture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val metadata = extractMetadata(outputFile)
                    continuation.resume(PhotoResult(
                        path = outputFile.absolutePath,
                        width = metadata.width,
                        height = metadata.height,
                        orientation = currentOrientation,
                        timestamp = System.currentTimeMillis()
                    ))
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed", exception)
                    continuation.resumeWithException(exception)
                }
            }
        )
    }

    private fun extractMetadata(file: File): PhotoMetadata {
        val exif = androidx.exifinterface.media.ExifInterface(file)
        val width = exif.getAttributeInt(ExifInterface.TAG_IMAGE_WIDTH, 0)
        val height = exif.getAttributeInt(ExifInterface.TAG_IMAGE_LENGTH, 0)
        return PhotoMetadata(width, height)
    }

    fun setLensFacing(facing: String) {
        lensFacing = when (facing) {
            "front" -> CameraSelector.LENS_FACING_FRONT
            else -> CameraSelector.LENS_FACING_BACK
        }
    }

    fun setFlashMode(mode: String) {
        flashMode = when (mode) {
            "on" -> ImageCapture.FLASH_MODE_ON
            "auto" -> ImageCapture.FLASH_MODE_AUTO
            else -> ImageCapture.FLASH_MODE_OFF
        }
        imageCapture?.flashMode = flashMode
    }

    fun setZoom(ratio: Float) {
        camera?.cameraControl?.setZoomRatio(ratio.coerceIn(1f, getMaxZoom()))
    }

    fun getMaxZoom(): Float {
        return camera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f
    }

    fun focus(x: Float, y: Float) {
        val factory = SurfaceOrientedMeteringPointFactory(1f, 1f)
        val point = factory.createPoint(x, y)
        val action = FocusMeteringAction.Builder(point).build()
        camera?.cameraControl?.startFocusAndMetering(action)
    }

    fun stopCamera() {
        cameraProvider?.unbindAll()
        sensorManager?.unregisterListener(this)
    }

    fun release() {
        stopCamera()
        cameraExecutor.shutdown()
    }
}

data class PhotoResult(
    val path: String,
    val width: Int,
    val height: Int,
    val orientation: Int,
    val timestamp: Long
)

data class PhotoMetadata(
    val width: Int,
    val height: Int
)
```

### Step 3: Create Camera View

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/camera/Zcam1CameraView.kt`

```kotlin
package com.zcam1sdk.camera

import android.content.Context
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.uimanager.ThemedReactContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class Zcam1CameraView(context: ThemedReactContext) : FrameLayout(context) {

    private val previewView: PreviewView = PreviewView(context)
    private val cameraService: Zcam1CameraService = Zcam1CameraService(context)
    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    init {
        addView(previewView, LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT
        ))
    }

    fun startCamera(lifecycleOwner: LifecycleOwner) {
        coroutineScope.launch {
            try {
                cameraService.startCamera(previewView, lifecycleOwner)
            } catch (e: Exception) {
                // Handle error
            }
        }
    }

    fun stopCamera() {
        cameraService.stopCamera()
    }

    fun getCameraService(): Zcam1CameraService = cameraService

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cameraService.release()
    }
}
```

### Step 4: Create View Manager

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/camera/Zcam1CameraViewManager.kt`

```kotlin
package com.zcam1sdk.camera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class Zcam1CameraViewManager : SimpleViewManager<Zcam1CameraView>() {

    override fun getName(): String = "Zcam1CameraView"

    override fun createViewInstance(reactContext: ThemedReactContext): Zcam1CameraView {
        return Zcam1CameraView(reactContext)
    }

    @ReactProp(name = "cameraType")
    fun setCameraType(view: Zcam1CameraView, type: String) {
        view.getCameraService().setLensFacing(type)
    }

    @ReactProp(name = "flashMode")
    fun setFlashMode(view: Zcam1CameraView, mode: String) {
        view.getCameraService().setFlashMode(mode)
    }

    @ReactProp(name = "zoom")
    fun setZoom(view: Zcam1CameraView, zoom: Float) {
        view.getCameraService().setZoom(zoom)
    }
}
```

### Step 5: Update TurboModule

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/Zcam1SdkModule.kt`

Add camera-related methods:

```kotlin
// Add to existing Zcam1SdkModule class

private var cameraService: Zcam1CameraService? = null

@ReactMethod
fun takeNativePhoto(options: ReadableMap, promise: Promise) {
    val service = cameraService ?: run {
        promise.reject("CAMERA_NOT_READY", "Camera not initialized")
        return
    }

    CoroutineScope(Dispatchers.Main).launch {
        try {
            val outputDir = reactApplicationContext.cacheDir
            val outputFile = File(outputDir, "zcam1_${System.currentTimeMillis()}.jpg")

            val result = service.takePhoto(outputFile)

            val response = Arguments.createMap().apply {
                putString("path", result.path)
                putInt("width", result.width)
                putInt("height", result.height)
                putInt("orientation", result.orientation)
                putDouble("timestamp", result.timestamp.toDouble())
            }

            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("CAPTURE_FAILED", e.message, e)
        }
    }
}

@ReactMethod
fun setZoom(zoom: Double, promise: Promise) {
    cameraService?.setZoom(zoom.toFloat())
    promise.resolve(null)
}

@ReactMethod
fun setFlashMode(mode: String, promise: Promise) {
    cameraService?.setFlashMode(mode)
    promise.resolve(null)
}

@ReactMethod
fun focus(x: Double, y: Double, promise: Promise) {
    cameraService?.focus(x.toFloat(), y.toFloat())
    promise.resolve(null)
}

@ReactMethod
fun getMaxZoom(promise: Promise) {
    val maxZoom = cameraService?.getMaxZoom() ?: 1f
    promise.resolve(maxZoom.toDouble())
}
```

### Step 6: Update Package Registration

**File:** `react-native-zcam1-capture/android/src/main/java/com/zcam1sdk/Zcam1SdkPackage.kt`

```kotlin
package com.zcam1sdk

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.zcam1sdk.camera.Zcam1CameraViewManager

class Zcam1SdkPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(Zcam1SdkModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(Zcam1CameraViewManager())
    }
}
```

---

## Files Summary

| File | Purpose |
|------|---------|
| `android/build.gradle` | Add CameraX dependencies |
| `camera/Zcam1CameraService.kt` | Core camera logic |
| `camera/Zcam1CameraView.kt` | React Native view wrapper |
| `camera/Zcam1CameraViewManager.kt` | View manager for props |
| `Zcam1SdkModule.kt` | TurboModule methods |
| `Zcam1SdkPackage.kt` | Package registration |

---

## Feature Parity with iOS

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| Photo capture | ✅ | ✅ | CameraX ImageCapture |
| Video recording | ✅ | 🔄 | CameraX VideoCapture (add later) |
| Depth data | ✅ | ❌ | Limited Android support |
| Orientation detection | ✅ | ✅ | Accelerometer-based |
| Film styles/filters | ✅ | 🔄 | Add with GPUImage or similar |
| Flash control | ✅ | ✅ | Built into CameraX |
| Zoom | ✅ | ✅ | CameraControl.setZoomRatio |
| Focus | ✅ | ✅ | FocusMeteringAction |
| Front/back camera | ✅ | ✅ | CameraSelector |

---

## Testing Checklist

- [ ] Camera preview displays correctly
- [ ] Photo capture works on back camera
- [ ] Photo capture works on front camera
- [ ] Orientation is correct in captured photos
- [ ] Flash modes work (on, off, auto)
- [ ] Zoom works
- [ ] Focus tap works
- [ ] Camera stops when view unmounts
- [ ] Works on various Android versions (API 24+)
- [ ] Handles permission requests gracefully

---

## Deliverables

### Files to Create

| Deliverable | File Path | Type |
|-------------|-----------|------|
| Camera service | `android/src/main/java/com/zcam1sdk/camera/Zcam1CameraService.kt` | Create |
| Camera view | `android/src/main/java/com/zcam1sdk/camera/Zcam1CameraView.kt` | Create |
| View manager | `android/src/main/java/com/zcam1sdk/camera/Zcam1CameraViewManager.kt` | Create |
| Photo result types | `android/src/main/java/com/zcam1sdk/camera/PhotoResult.kt` | Create |
| Module camera methods | `android/src/main/java/com/zcam1sdk/Zcam1SdkModule.kt` | Modify |
| Package registration | `android/src/main/java/com/zcam1sdk/Zcam1SdkPackage.kt` | Modify |
| Gradle dependencies | `android/build.gradle` | Modify |
| Camera unit tests | `android/src/test/java/com/zcam1sdk/camera/CameraServiceTest.kt` | Create |

---

## Interface Definitions

### Kotlin Classes

```kotlin
// Zcam1CameraService.kt
class Zcam1CameraService(private val context: Context) : SensorEventListener {
    suspend fun startCamera(previewView: PreviewView, lifecycleOwner: LifecycleOwner)
    suspend fun takePhoto(outputFile: File): PhotoResult
    fun setLensFacing(facing: String)  // "front" | "back"
    fun setFlashMode(mode: String)     // "on" | "off" | "auto"
    fun setZoom(ratio: Float)
    fun getMaxZoom(): Float
    fun focus(x: Float, y: Float)
    fun stopCamera()
    fun release()
}

// Zcam1CameraView.kt
class Zcam1CameraView(context: ThemedReactContext) : FrameLayout(context) {
    fun startCamera(lifecycleOwner: LifecycleOwner)
    fun stopCamera()
    fun getCameraService(): Zcam1CameraService
}

// Zcam1CameraViewManager.kt
class Zcam1CameraViewManager : SimpleViewManager<Zcam1CameraView>() {
    @ReactProp(name = "cameraType") fun setCameraType(view: Zcam1CameraView, type: String)
    @ReactProp(name = "flashMode") fun setFlashMode(view: Zcam1CameraView, mode: String)
    @ReactProp(name = "zoom") fun setZoom(view: Zcam1CameraView, zoom: Float)
}
```

### Data Classes

```kotlin
data class PhotoResult(
    val path: String,
    val width: Int,
    val height: Int,
    val orientation: Int,    // 0, 90, 180, 270
    val timestamp: Long
)

data class PhotoMetadata(
    val width: Int,
    val height: Int
)
```

### Native Module Methods

```kotlin
// Add to Zcam1SdkModule.kt
@ReactMethod
fun takeNativePhoto(options: ReadableMap, promise: Promise)

@ReactMethod
fun setZoom(zoom: Double, promise: Promise)

@ReactMethod
fun setFlashMode(mode: String, promise: Promise)

@ReactMethod
fun focus(x: Double, y: Double, promise: Promise)

@ReactMethod
fun getMaxZoom(promise: Promise)
```

---

## Testing Plan

### Unit Tests

| Test | Purpose |
|------|---------|
| `test_orientation_portrait` | Verify 0° orientation from accelerometer |
| `test_orientation_landscape_left` | Verify 90° orientation |
| `test_orientation_landscape_right` | Verify 270° orientation |
| `test_orientation_upside_down` | Verify 180° orientation |
| `test_flash_mode_mapping` | Verify string to CameraX constant mapping |
| `test_zoom_clamping` | Verify zoom stays within 1.0 - maxZoom |
| `test_lens_facing_mapping` | Verify "front"/"back" to CameraSelector |
| `test_photo_result_serialization` | Verify data class maps to React Native |

### Integration Tests

| Test | Description |
|------|-------------|
| `test_camera_lifecycle` | Start camera, take photo, stop camera |
| `test_switch_cameras` | Switch between front and back |
| `test_flash_modes` | Cycle through all flash modes |
| `test_zoom_range` | Test zoom from 1x to max |
| `test_orientation_during_capture` | Rotate device, verify photo orientation |
| `test_rapid_capture` | Take multiple photos quickly |

### Device Test Matrix

| Device | API Level | Features to Test |
|--------|-----------|------------------|
| Pixel 6+ | 33 | StrongBox, all cameras, max zoom |
| Pixel 4 | 30 | TEE, front/back cameras |
| Samsung S21 | 31 | OEM camera stack compatibility |
| Emulator x86_64 | 30 | Basic capture flow |
| Low-end device | 24 | Minimum API level support |

### Manual Testing Checklist

| Test Case | Pass |
|-----------|------|
| Camera preview displays correctly | ⬜ |
| Photo capture works on back camera | ⬜ |
| Photo capture works on front camera | ⬜ |
| Orientation is correct in all 4 rotations | ⬜ |
| Flash mode "on" fires flash | ⬜ |
| Flash mode "off" no flash | ⬜ |
| Flash mode "auto" works in low light | ⬜ |
| Zoom responds to prop changes | ⬜ |
| Focus tap shows focus ring | ⬜ |
| Camera stops when view unmounts | ⬜ |
| No memory leaks after repeated open/close | ⬜ |
| Handles permission denial gracefully | ⬜ |

---

## Completion Criteria

### Must Have (Required for task completion)

- [ ] **CameraX integration works**
  - Camera preview displays in React Native view
  - ProcessCameraProvider binds successfully
  - ImageCapture use case configured

- [ ] **Photo capture works**
  - `takePhoto()` returns valid PhotoResult
  - Photo saved to specified file path
  - Width/height extracted correctly
  - Orientation matches device position

- [ ] **Orientation detection works**
  - Accelerometer-based detection (0.75g threshold)
  - Correct values: 0, 90, 180, 270
  - Updates in real-time

- [ ] **Camera controls work**
  - `setLensFacing()` switches front/back
  - `setFlashMode()` sets on/off/auto
  - `setZoom()` changes zoom level
  - `focus()` triggers focus at coordinates

- [ ] **React Native integration works**
  - ViewManager exposes props correctly
  - Native module methods callable from JS
  - Events propagate to React Native

- [ ] **Lifecycle management works**
  - Camera starts when view mounts
  - Camera stops when view unmounts
  - No memory leaks
  - Executor properly shutdown

- [ ] **Unit tests pass**
  - All orientation tests pass
  - All mapping tests pass
  - Code coverage > 70%

### Should Have (Expected but not blocking)

- [ ] **Works on emulator**
  - Basic capture flow works on x86_64 emulator

- [ ] **Works on multiple devices**
  - Tested on at least 2 different device manufacturers

- [ ] **Error handling**
  - Graceful handling of camera permission denied
  - Graceful handling of camera in use by other app
  - Clear error messages

### Nice to Have (Not required)

- [ ] **Video recording support**
- [ ] **Film style filters (GPUImage integration)**
- [ ] **Depth data capture**
- [ ] **Exposure control**

---

## Verification Commands

```bash
# Run Kotlin unit tests
cd react-native-zcam1-capture/android
./gradlew test

# Run specific camera tests
./gradlew test --tests "com.zcam1sdk.camera.*"

# Build Android
./gradlew assembleDebug

# Run on device
cd ../..
npx react-native run-android

# Run integration tests
npx detox test -c android.emu.debug --testNamePattern "camera"
```

---

## Handoff to Next Tasks

### Output for Task 05 (TypeScript Integration)

This task provides native camera functionality that Task 05 wraps:

```typescript
// TypeScript can call these native methods:
await NativeZcam1Sdk.takeNativePhoto({ flashMode: "on" });
await NativeZcam1Sdk.setZoom(2.0);
await NativeZcam1Sdk.setFlashMode("auto");
await NativeZcam1Sdk.focus(0.5, 0.5);

// React Native view component available:
<Zcam1CameraView
  cameraType="back"
  flashMode="auto"
  zoom={1.5}
/>
```

### Integration with Task 01 (Attestation)

After photo capture, the signing flow uses Task 01's Kotlin method:

```kotlin
// In takeNativePhoto callback:
val photoResult = cameraService.takePhoto(outputFile)
// Photo hash computed, then signed via signWithHardwareKey
```

---

## Next Steps

After this task:
- Task 05 (TypeScript) wraps native camera in React component
- Integration with attestation signing (Task 01)
- Integration with C2PA embedding
- Add video recording support (future)
- Add film style filters (future)
