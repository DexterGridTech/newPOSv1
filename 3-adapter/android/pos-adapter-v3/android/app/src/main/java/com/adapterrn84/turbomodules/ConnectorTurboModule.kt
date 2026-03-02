package com.adapterrn84.turbomodules

import com.adapterrn84.NativeConnectorTurboModuleSpec
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Arguments
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    NativeConnectorTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"

        // 静态持有实例，供 MainActivity 访问
        @Volatile
        private var instance: ConnectorTurboModule? = null

        fun getInstance(): ConnectorTurboModule? = instance
    }

    private val connectorManager = ConnectorManager(reactApplicationContext)
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    init {
        // 注册实例到静态持有者
        instance = this
        android.util.Log.d(NAME, "ConnectorTurboModule instance registered")
    }

    override fun getName(): String = NAME

    override fun call(
        channelJson: String,
        action: String,
        paramsJson: String,
        timeout: Double,
        promise: Promise
    ) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val params = parseParams(paramsJson)
                val result = connectorManager.call(
                    descriptor,
                    action,
                    params,
                    timeout.toLong()
                )
                promise.resolve(result.toJson())
            } catch (e: Exception) {
                promise.reject("CALL_ERROR", e.message, e)
            }
        }
    }

    override fun subscribe(channelJson: String, promise: Promise) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val channelId = connectorManager.subscribe(descriptor)
                promise.resolve(channelId)
            } catch (e: Exception) {
                promise.reject("SUBSCRIBE_ERROR", e.message, e)
            }
        }
    }

    override fun unsubscribe(channelId: String, promise: Promise) {
        moduleScope.launch {
            try {
                connectorManager.unsubscribe(channelId)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("UNSUBSCRIBE_ERROR", e.message, e)
            }
        }
    }

    override fun isAvailable(channelJson: String, promise: Promise) {
        moduleScope.launch {
            try {
                val descriptor = ChannelDescriptor.fromJson(channelJson)
                val available = connectorManager.isAvailable(descriptor)
                promise.resolve(available)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    override fun getAvailableTargets(type: String, promise: Promise) {
        moduleScope.launch {
            try {
                val channelType = ChannelType.fromString(type)
                val targets = connectorManager.getAvailableTargets(channelType)
                val array = Arguments.createArray()
                targets.forEach { array.pushString(it) }
                promise.resolve(array)
            } catch (e: Exception) {
                promise.resolve(Arguments.createArray())
            }
        }
    }

    override fun addListener(eventName: String?) {
        // Required by NativeEventEmitter, no-op
    }

    override fun removeListeners(count: Double) {
        // Required by NativeEventEmitter, no-op
    }

    override fun invalidate() {
        // 清理实例引用
        instance = null
        android.util.Log.d(NAME, "ConnectorTurboModule instance unregistered")
        connectorManager.cleanup()
        super.invalidate()
    }

    /**
     * 获取 ConnectorManager 实例
     * 用于 MainActivity 访问 EventDispatcher 和 PermissionCoordinator
     */
    fun getConnectorManager(): ConnectorManager = connectorManager

    /**
     * 处理按键事件（用于 HID 通道）
     * @return true 表示事件已被消费，不应传递给系统；false 表示不处理，应传递给系统
     */
    fun onKeyEvent(event: android.view.KeyEvent): Boolean {
        val activeHidChannels = connectorManager.getChannelRegistry().getActiveHidChannels()
        android.util.Log.d("ConnectorTurboModule", "onKeyEvent: activeHidChannels.size=${activeHidChannels.size}")
        if (activeHidChannels.isEmpty()) return false

        var consumed = false
        activeHidChannels.values.forEach { ch ->
            val result = ch.onKeyEvent(event)
            android.util.Log.d("ConnectorTurboModule", "channel.onKeyEvent returned $result")
            if (result) consumed = true
        }
        android.util.Log.d("ConnectorTurboModule", "final consumed=$consumed")
        return consumed
    }

    private fun parseParams(json: String): Map<String, String> {
        val result = mutableMapOf<String, String>()
        try {
            val obj = org.json.JSONObject(json)
            obj.keys().forEach { key ->
                result[key] = obj.getString(key)
            }
        } catch (_: Exception) {
            // 返回空 map
        }
        return result
    }
}
