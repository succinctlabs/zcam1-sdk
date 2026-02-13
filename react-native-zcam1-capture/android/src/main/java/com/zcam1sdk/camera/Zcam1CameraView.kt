package com.zcam1sdk.camera

import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.uimanager.ThemedReactContext

/**
 * React Native camera view. Hosts a CameraX PreviewView and manages
 * the camera service lifecycle tied to the view's window attachment.
 *
 * Handles React Native Fabric's view recycling: Fabric may detach and
 * re-attach the view during layout passes. We delay camera teardown
 * to avoid restarting the camera on every re-layout.
 */
class Zcam1CameraView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {

    private val previewView = PreviewView(reactContext)
    private val cameraService = Zcam1CameraService()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingTeardown: Runnable? = null
    private var cameraStarted = false

    var cameraType: String = "back"
        set(value) {
            if (field != value) {
                field = value
                if (cameraStarted) restartCamera()
            }
        }

    var flashMode: String = "off"
        set(value) {
            field = value
            cameraService.setFlashMode(value)
        }

    var zoom: Float = 1.0f
        set(value) {
            field = value
            cameraService.setZoom(value)
        }

    init {
        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    /**
     * Override requestLayout to work with Fabric's measurement system.
     * Without this, the PreviewView may not render correctly after Fabric layout passes.
     */
    override fun requestLayout() {
        super.requestLayout()
        post {
            measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        // Cancel any pending teardown — this is just Fabric re-attaching us
        pendingTeardown?.let {
            mainHandler.removeCallbacks(it)
            pendingTeardown = null
        }
        if (!cameraStarted) {
            Zcam1OrientationManager.startUpdates(reactContext)
            startCamera()
        }
    }

    override fun onDetachedFromWindow() {
        // Delay teardown to distinguish real removal from Fabric re-layout
        pendingTeardown = Runnable {
            pendingTeardown = null
            cameraService.stopCamera()
            Zcam1OrientationManager.stopUpdates()
            cameraStarted = false
        }
        mainHandler.postDelayed(pendingTeardown!!, 200)
        super.onDetachedFromWindow()
    }

    private fun startCamera() {
        val lifecycleOwner = reactContext.currentActivity as? LifecycleOwner ?: return

        cameraService.startCamera(
            context = reactContext,
            lifecycleOwner = lifecycleOwner,
            surfaceProvider = previewView.surfaceProvider,
            lensFacing = cameraType,
            flashMode = flashMode
        )
        cameraStarted = true
    }

    private fun restartCamera() {
        cameraService.stopCamera()
        startCamera()
    }
}
