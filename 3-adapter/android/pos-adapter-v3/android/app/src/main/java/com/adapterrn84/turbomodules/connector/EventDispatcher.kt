package com.adapterrn84.turbomodules.connector

import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 统一事件分发器
 * 替代多个全局单例，集中管理所有事件分发逻辑
 */
class EventDispatcher(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope
) {
    // HID 通道注册表
    private val hidChannels = ConcurrentHashMap<String, CopyOnWriteArrayList<HidEventHandler>>()

    // Activity Result 回调
    private val activityResultCallbacks = ConcurrentHashMap<Int, ActivityResultCallback>()

    interface HidEventHandler {
        suspend fun onKeyEvent(keyCode: Int, event: KeyEvent)
    }

    interface ActivityResultCallback {
        fun onResult(resultCode: Int, data: android.content.Intent?)
    }

    /**
     * 发送流事件到 TS 层
     */
    fun sendStreamEvent(event: ConnectorEvent) {
        try {
            val params = WritableNativeMap().apply {
                putString("channelId", event.channelId)
                putString("type", event.type)
                putString("target", event.target)
                if (event.data != null) {
                    putString("data", event.data)
                } else {
                    putNull("data")
                }
                putDouble("timestamp", event.timestamp.toDouble())
                if (event.raw != null) putString("raw", event.raw)
            }

            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("connector.stream", params)
        } catch (_: Exception) {
            // ReactContext may be invalidated
        }
    }

    /**
     * 发送被动事件到 TS 层
     */
    fun sendPassiveEvent(event: ConnectorEvent) {
        try {
            val params = WritableNativeMap().apply {
                putString("channelId", event.channelId)
                putString("type", event.type)
                putString("target", event.target)
                if (event.data != null) {
                    putString("data", event.data)
                } else {
                    putNull("data")
                }
                putDouble("timestamp", event.timestamp.toDouble())
                if (event.raw != null) putString("raw", event.raw)
            }

            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("connector.passive", params)
        } catch (_: Exception) {
            // ReactContext may be invalidated
        }
    }

    /**
     * 注册 HID 事件处理器
     */
    fun registerHidHandler(target: String, handler: HidEventHandler) {
        hidChannels.getOrPut(target) { CopyOnWriteArrayList() }.add(handler)
    }

    /**
     * 注销 HID 事件处理器
     */
    fun unregisterHidHandler(target: String, handler: HidEventHandler) {
        hidChannels[target]?.remove(handler)
        if (hidChannels[target]?.isEmpty() == true) {
            hidChannels.remove(target)
        }
    }

    /**
     * 分发按键事件到所有 HID 通道
     */
    fun dispatchKeyEvent(keyCode: Int, event: KeyEvent) {
        scope.launch(Dispatchers.IO) {
            hidChannels.values.flatten().forEach { handler ->
                try {
                    handler.onKeyEvent(keyCode, event)
                } catch (_: Exception) {
                    // Ignore errors in individual handlers
                }
            }
        }
    }

    /**
     * 检查是否有活跃的 HID 通道
     */
    fun hasActiveHidChannels(): Boolean {
        return hidChannels.isNotEmpty()
    }

    /**
     * 注册 Activity Result 回调
     */
    fun registerActivityResultCallback(requestCode: Int, callback: ActivityResultCallback) {
        activityResultCallbacks[requestCode] = callback
    }

    /**
     * 注销 Activity Result 回调
     */
    fun unregisterActivityResultCallback(requestCode: Int) {
        activityResultCallbacks.remove(requestCode)
    }

    /**
     * 分发 Activity Result
     */
    fun dispatchActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        activityResultCallbacks.remove(requestCode)?.onResult(resultCode, data)
    }

    /**
     * 清理所有注册
     */
    fun cleanup() {
        hidChannels.clear()
        activityResultCallbacks.clear()
    }
}
