package com.adapterrn84.turbomodules

import com.adapterrn84.NativeConnectorTurboModuleSpec
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    NativeConnectorTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"
    }

    private val connectorManager = ConnectorManager(reactApplicationContext)
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

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
                promise.resolve(targets.toTypedArray())
            } catch (e: Exception) {
                promise.resolve(emptyArray<String>())
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
        connectorManager.cleanup()
        super.invalidate()
    }

    /**
     * 获取 ConnectorManager 实例
     * 用于 MainActivity 访问 EventDispatcher 和 PermissionCoordinator
     */
    fun getConnectorManager(): ConnectorManager = connectorManager

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
