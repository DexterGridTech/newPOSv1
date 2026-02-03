package com.impos2.turbomodules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.turbomodules.systemstatus.SystemStatusManager

/**
 * SystemStatus TurboModule
 *
 * 优化点:
 * 1. 使用单例 SystemStatusManager，支持多 ReactInstanceManager 场景
 * 2. 提供完整的系统状态接口
 * 3. 支持电源状态变化监听
 */
class SystemStatusTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "SystemStatusTurboModule"
        const val NAME = "SystemStatusTurboModule"
        private const val EVENT_POWER_STATUS_CHANGED = "onPowerStatusChanged"
    }

    private val systemStatusManager: SystemStatusManager by lazy {
        SystemStatusManager.getInstance(reactApplicationContext)
    }

    private var powerStatusReceiver: BroadcastReceiver? = null
    private val powerStatusHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var powerStatusRunnable: Runnable? = null

    override fun getName(): String = NAME

    /**
     * 获取系统状态
     */
    @ReactMethod
    fun getSystemStatus(promise: Promise) {
        try {
            val status = systemStatusManager.getSystemStatus()
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e(TAG, "getSystemStatus 失败", e)
            promise.reject("GET_SYSTEM_STATUS_ERROR", e.message, e)
        }
    }

    /**
     * 开始监听电源状态变化
     */
    @ReactMethod
    fun startPowerStatusListener() {
        try {
            if (powerStatusReceiver != null) {
                Log.w(TAG, "电源状态接收器已注册，跳过")
                return
            }

            powerStatusReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    // 取消之前的延迟任务
                    powerStatusRunnable?.let { powerStatusHandler.removeCallbacks(it) }

                    // 创建新的延迟任务（防抖处理）
                    powerStatusRunnable = Runnable {
                        sendPowerStatusChangeEvent(intent)
                    }

                    // 延迟1秒后执行
                    powerStatusHandler.postDelayed(powerStatusRunnable!!, 1000L)
                }
            }

            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_POWER_CONNECTED)
                addAction(Intent.ACTION_POWER_DISCONNECTED)
                addAction(Intent.ACTION_BATTERY_CHANGED)
            }

            reactApplicationContext.registerReceiver(powerStatusReceiver, filter)
            Log.d(TAG, "电源状态接收器注册成功")
        } catch (e: Exception) {
            Log.e(TAG, "startPowerStatusListener 失败", e)
        }
    }

    /**
     * 停止监听电源状态变化
     */
    @ReactMethod
    fun stopPowerStatusListener() {
        try {
            // 取消延迟任务
            powerStatusRunnable?.let { powerStatusHandler.removeCallbacks(it) }
            powerStatusRunnable = null

            powerStatusReceiver?.let {
                reactApplicationContext.unregisterReceiver(it)
                powerStatusReceiver = null
                Log.d(TAG, "电源状态接收器注销成功")
            }
        } catch (e: Exception) {
            Log.e(TAG, "stopPowerStatusListener 失败", e)
        }
    }

    /**
     * 发送电源状态变化事件
     */
    private fun sendPowerStatusChangeEvent(intent: Intent?) {
        if (intent == null) return

        try {
            // 获取电池状态
            val action = intent.action
            val batteryIntent = if (action == Intent.ACTION_POWER_CONNECTED ||
                                    action == Intent.ACTION_POWER_DISCONNECTED) {
                // 主动查询当前电池状态
                reactApplicationContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            } else {
                intent
            }

            if (batteryIntent == null) return

            // 解析电池信息
            val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val batteryPct = if (level >= 0 && scale > 0) (level * 100 / scale) else 0

            val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                           status == BatteryManager.BATTERY_STATUS_FULL

            val plugged = batteryIntent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
            val powerConnected = plugged > 0

            val statusStr = when (status) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
                BatteryManager.BATTERY_STATUS_FULL -> "full"
                BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
                else -> "unknown"
            }

            val health = batteryIntent.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)
            val healthStr = when (health) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
                BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
                BatteryManager.BATTERY_HEALTH_COLD -> "cold"
                else -> "unknown"
            }

            val event = Arguments.createMap().apply {
                putBoolean("powerConnected", powerConnected)
                putBoolean("isCharging", isCharging)
                putInt("batteryLevel", batteryPct)
                putString("batteryStatus", statusStr)
                putString("batteryHealth", healthStr)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            sendEvent(EVENT_POWER_STATUS_CHANGED, event)
            Log.d(TAG, "电源状态变化事件已发送: powerConnected=$powerConnected, status=$statusStr")
        } catch (e: Exception) {
            Log.e(TAG, "发送电源状态变化事件失败", e)
        }
    }

    /**
     * 添加监听器（NativeEventEmitter 需要）
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // NativeEventEmitter 需要此方法
        // 实际的监听器注册在 startPowerStatusListener 中完成
    }

    /**
     * 移除监听器（NativeEventEmitter 需要）
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // NativeEventEmitter 需要此方法
        // 实际的监听器注销在 stopPowerStatusListener 中完成
    }

    /**
     * 发送事件到 JavaScript
     */
    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopPowerStatusListener()
    }
}
