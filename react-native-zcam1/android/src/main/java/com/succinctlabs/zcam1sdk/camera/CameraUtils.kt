package com.succinctlabs.zcam1sdk.camera

/**
 * Pure utility functions for camera operations.
 * No Android framework dependencies — testable with plain JUnit.
 *
 * Flash and lens facing constants mirror CameraX values so they can be
 * passed directly to ImageCapture.flashMode and CameraSelector.requireLensFacing.
 */
object CameraUtils {

    // 0.75g threshold in m/s² (matching iOS CoreMotion ±0.75g)
    // 0.75 * 9.80665 = 7.354987...
    private const val GRAVITY_THRESHOLD = 7.355f

    // ImageCapture flash mode constants
    const val FLASH_AUTO = 0  // ImageCapture.FLASH_MODE_AUTO
    const val FLASH_ON = 1    // ImageCapture.FLASH_MODE_ON
    const val FLASH_OFF = 2   // ImageCapture.FLASH_MODE_OFF

    // CameraSelector lens facing constants
    const val LENS_FACING_FRONT = 0  // CameraSelector.LENS_FACING_FRONT
    const val LENS_FACING_BACK = 1   // CameraSelector.LENS_FACING_BACK

    /**
     * Compute device orientation from accelerometer readings.
     *
     * Android accelerometer returns m/s² including gravity reaction force.
     * Portrait upright: y ≈ +9.81, Upside down: y ≈ -9.81
     * Landscape left (CCW): x ≈ +9.81, Landscape right (CW): x ≈ -9.81
     *
     * When no axis exceeds the threshold (device at ~45°), the current
     * orientation is preserved (deadzone behavior matching iOS).
     *
     * @param x Accelerometer x-axis value in m/s²
     * @param y Accelerometer y-axis value in m/s²
     * @param current Current orientation to preserve in deadzone
     * @return Orientation in degrees: 0, 90, 180, or 270
     */
    fun computeOrientation(x: Float, y: Float, current: Int): Int {
        return when {
            x > GRAVITY_THRESHOLD -> 90    // landscape left
            x < -GRAVITY_THRESHOLD -> 270  // landscape right
            y > GRAVITY_THRESHOLD -> 0     // portrait
            y < -GRAVITY_THRESHOLD -> 180  // upside down
            else -> current                // deadzone: keep current
        }
    }

    /**
     * Map flash mode string to CameraX integer constant.
     * @param mode "on", "off", or "auto" (case-insensitive)
     * @return Flash mode constant (FLASH_ON, FLASH_OFF, or FLASH_AUTO)
     */
    fun mapFlashMode(mode: String): Int = when (mode.lowercase()) {
        "on" -> FLASH_ON
        "auto" -> FLASH_AUTO
        else -> FLASH_OFF
    }

    /**
     * Clamp zoom ratio to valid range [1.0, maxZoom].
     * @param requested Desired zoom ratio
     * @param maxZoom Maximum zoom ratio from camera info
     * @return Clamped zoom ratio
     */
    fun clampZoom(requested: Float, maxZoom: Float): Float {
        return requested.coerceIn(1.0f, maxZoom)
    }

    /**
     * Map lens facing string to CameraX integer constant.
     * @param facing "front" or "back" (case-insensitive)
     * @return Lens facing constant (LENS_FACING_FRONT or LENS_FACING_BACK)
     */
    fun mapLensFacing(facing: String): Int = when (facing.lowercase()) {
        "front" -> LENS_FACING_FRONT
        else -> LENS_FACING_BACK
    }
}
