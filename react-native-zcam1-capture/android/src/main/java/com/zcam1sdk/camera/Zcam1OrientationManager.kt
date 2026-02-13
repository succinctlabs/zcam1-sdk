package com.zcam1sdk.camera

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper

/**
 * Singleton orientation manager using accelerometer.
 * Matches iOS Zcam1MotionManager: 5Hz updates, 0.75g threshold, deadzone.
 * Works even when device rotation lock is enabled.
 */
object Zcam1OrientationManager : SensorEventListener {

    private var sensorManager: SensorManager? = null
    @Volatile
    private var cachedOrientation: Int = 0
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners = mutableMapOf<Int, (Int) -> Unit>()
    private var nextToken = 0

    fun startUpdates(context: Context) {
        if (sensorManager != null) return

        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        sensorManager = sm
        val accelerometer = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return

        // 200_000 microseconds = 200ms = 5 Hz (matching iOS)
        sm.registerListener(this, accelerometer, 200_000)
    }

    fun stopUpdates() {
        sensorManager?.unregisterListener(this)
        sensorManager = null
    }

    fun currentOrientation(): Int = cachedOrientation

    fun addListener(callback: (Int) -> Unit): Int = synchronized(this) {
        val token = nextToken++
        listeners[token] = callback
        token
    }

    fun removeListener(token: Int) = synchronized(this) {
        listeners.remove(token)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event ?: return
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val newOrientation = CameraUtils.computeOrientation(
            x = event.values[0],
            y = event.values[1],
            current = cachedOrientation
        )

        if (newOrientation != cachedOrientation) {
            cachedOrientation = newOrientation
            val currentListeners = synchronized(this) { listeners.values.toList() }
            mainHandler.post {
                currentListeners.forEach { it(newOrientation) }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
