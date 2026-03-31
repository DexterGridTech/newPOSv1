package com.mixcretail.turbomodules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.adapter.device.DeviceManager
import com.impos2.adapter.interfaces.PowerStatus

@ReactModule(name = DeviceTurboModule.NAME)
class DeviceTurboModule(reactContext: ReactApplicationContext) :
    NativeDeviceTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "DeviceTurboModule"
        private const val EVENT_POWER_STATUS_CHANGED = "onPowerStatusChanged"
    }

    private val deviceManager by lazy { DeviceManager.getInstance(reactApplicationContext) }
    private var powerReceiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())
    private var debounceRunnable: Runnable? = null
    private var lastPowerConnected: Boolean? = null

    override fun getName() = NAME

    override fun getDeviceInfo(promise: Promise) {
        try {
            val info = deviceManager.getDeviceInfo()
            promise.resolve(Arguments.createMap().apply {
                putString("id", info.id)
                putString("manufacturer", info.manufacturer)
                putString("os", info.os)
                putString("osVersion", info.osVersion)
                putString("cpu", info.cpu)
                putString("memory", info.memory)
                putString("disk", info.disk)
                putString("network", info.network)
                putArray("displays", Arguments.createArray().apply {
                    info.displays.forEach { d ->
                        pushMap(Arguments.createMap().apply {
                            putString("id", d.id)
                            putString("displayType", d.displayType)
                            putInt("refreshRate", d.refreshRate)
                            putInt("width", d.width)
                            putInt("height", d.height)
                            putInt("physicalWidth", d.physicalWidth)
                            putInt("physicalHeight", d.physicalHeight)
                            putBoolean("touchSupport", d.touchSupport)
                        })
                    }
                })
            })
        } catch (e: Exception) {
            promise.reject("GET_DEVICE_INFO_ERROR", e.message, e)
        }
    }

    override fun getSystemStatus(promise: Promise) {
        try {
            val status = deviceManager.getSystemStatus()
            promise.resolve(Arguments.createMap().apply {
                putMap("cpu", Arguments.createMap().apply {
                    putDouble("app", status.cpu.app)
                    putInt("cores", status.cpu.cores)
                })
                putMap("memory", Arguments.createMap().apply {
                    putDouble("total", status.memory.total)
                    putDouble("app", status.memory.app)
                    putDouble("appPercentage", status.memory.appPercentage)
                })
                putMap("disk", Arguments.createMap().apply {
                    putDouble("total", status.disk.total)
                    putDouble("used", status.disk.used)
                    putDouble("available", status.disk.available)
                    putDouble("overall", status.disk.overall)
                    putDouble("app", status.disk.app)
                })
                putMap("power", convertPowerStatus(status.power))
                putArray("usbDevices", Arguments.createArray())
                putArray("bluetoothDevices", Arguments.createArray())
                putArray("serialDevices", Arguments.createArray())
                putArray("networks", Arguments.createArray())
                putArray("installedApps", Arguments.createArray())
                putDouble("updatedAt", status.updatedAt.toDouble())
            })
        } catch (e: Exception) {
            promise.reject("GET_SYSTEM_STATUS_ERROR", e.message, e)
        }
    }

    override fun startPowerStatusListener() {
        if (powerReceiver != null) return
        deviceManager.addPowerStatusListener { power ->
            debounceRunnable?.let { handler.removeCallbacks(it) }
            debounceRunnable = Runnable { sendPowerEvent(power) }
            handler.postDelayed(debounceRunnable!!, 500L)
        }
    }

    override fun stopPowerStatusListener() {
        debounceRunnable?.let { handler.removeCallbacks(it) }
        debounceRunnable = null
    }

    private fun convertPowerStatus(power: PowerStatus): WritableMap {
        return Arguments.createMap().apply {
            putBoolean("powerConnected", power.powerConnected)
            putBoolean("isCharging", power.isCharging)
            putInt("batteryLevel", power.batteryLevel)
            putString("batteryStatus", power.batteryStatus.lowercase())
            putString("batteryHealth", power.batteryHealth.lowercase())
        }
    }

    private fun sendPowerEvent(power: PowerStatus) {
        if (lastPowerConnected != power.powerConnected) {
            lastPowerConnected = power.powerConnected
            val event = convertPowerStatus(power).apply {
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_POWER_STATUS_CHANGED, event)
        }
    }

    override fun addListener(eventName: String) {}
    override fun removeListeners(count: Double) {}

    override fun invalidate() {
        super.invalidate()
        stopPowerStatusListener()
    }
}
