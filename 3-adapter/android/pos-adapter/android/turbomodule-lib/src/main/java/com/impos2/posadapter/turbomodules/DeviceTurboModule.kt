package com.impos2.posadapter.turbomodules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.posadapter.turbomodules.device.DeviceManager

class DeviceTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DeviceTurboModule"
        private const val EVENT_POWER_STATUS_CHANGED = "onPowerStatusChanged"
    }

    private val deviceManager by lazy { DeviceManager.getInstance(reactApplicationContext) }
    private var powerReceiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())
    private var debounceRunnable: Runnable? = null

    override fun getName() = NAME

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try { promise.resolve(deviceManager.getDeviceInfo()) }
        catch (e: Exception) { promise.reject("GET_DEVICE_INFO_ERROR", e.message, e) }
    }

    @ReactMethod
    fun getSystemStatus(promise: Promise) {
        try { promise.resolve(deviceManager.getSystemStatus()) }
        catch (e: Exception) { promise.reject("GET_SYSTEM_STATUS_ERROR", e.message, e) }
    }

    @ReactMethod
    fun startPowerStatusListener() {
        if (powerReceiver != null) return
        powerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                debounceRunnable?.let { handler.removeCallbacks(it) }
                debounceRunnable = Runnable { sendPowerEvent() }
                handler.postDelayed(debounceRunnable!!, 500L)
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
            addAction(Intent.ACTION_BATTERY_CHANGED)
        }
        reactApplicationContext.registerReceiver(powerReceiver, filter)
    }

    @ReactMethod
    fun stopPowerStatusListener() {
        debounceRunnable?.let { handler.removeCallbacks(it) }
        debounceRunnable = null
        powerReceiver?.let {
            reactApplicationContext.unregisterReceiver(it)
            powerReceiver = null
        }
    }

    private fun sendPowerEvent() {
        val power = deviceManager.getPowerStatus()
        power.putDouble("timestamp", System.currentTimeMillis().toDouble())
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_POWER_STATUS_CHANGED, power)
    }

    // NativeEventEmitter 需要
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopPowerStatusListener()
    }
}
