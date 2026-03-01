package com.impos2.posadapterrn84.turbomodules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.posadapterrn84.NativeDeviceTurboModuleSpec
import com.impos2.posadapterrn84.turbomodules.device.DeviceManager

class DeviceTurboModule(reactContext: ReactApplicationContext) :
    NativeDeviceTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "DeviceTurboModule"
        private const val EVENT_POWER_STATUS_CHANGED = "onPowerStatusChanged"
        private const val DEBOUNCE_MS = 500L
    }

    private val deviceManager by lazy { DeviceManager.getInstance(reactApplicationContext) }
    private var powerReceiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())
    private var debounceRunnable: Runnable? = null

    override fun getName(): String = NAME

    override fun getDeviceInfo(promise: Promise) {
        try {
            promise.resolve(deviceManager.getDeviceInfoJson())
        } catch (e: Exception) {
            promise.reject("GET_DEVICE_INFO_ERROR", e.message, e)
        }
    }

    override fun getSystemStatus(promise: Promise) {
        try {
            promise.resolve(deviceManager.getSystemStatusJson())
        } catch (e: Exception) {
            promise.reject("GET_SYSTEM_STATUS_ERROR", e.message, e)
        }
    }

    override fun startPowerStatusListener() {
        if (powerReceiver != null) return
        powerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                debounceRunnable?.let { handler.removeCallbacks(it) }
                debounceRunnable = Runnable { sendPowerEvent() }
                handler.postDelayed(debounceRunnable!!, DEBOUNCE_MS)
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
            addAction(Intent.ACTION_BATTERY_CHANGED)
        }
        reactApplicationContext.registerReceiver(powerReceiver, filter)
    }

    override fun stopPowerStatusListener() {
        debounceRunnable?.let { handler.removeCallbacks(it) }
        debounceRunnable = null
        powerReceiver?.let {
            try { reactApplicationContext.unregisterReceiver(it) } catch (_: Exception) {}
            powerReceiver = null
        }
    }

    override fun addListener(eventName: String?) {
        // Required by NativeEventEmitter, no-op
    }

    override fun removeListeners(count: Double) {
        // Required by NativeEventEmitter, no-op
    }

    private fun sendPowerEvent() {
        try {
            val powerJson = deviceManager.getPowerStatusJson()
            val params = WritableNativeMap().apply {
                putString("data", powerJson)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_POWER_STATUS_CHANGED, params)
        } catch (_: Exception) {
            // ReactContext may have been invalidated during shutdown
        }
    }

    override fun invalidate() {
        stopPowerStatusListener()
        super.invalidate()
    }
}
