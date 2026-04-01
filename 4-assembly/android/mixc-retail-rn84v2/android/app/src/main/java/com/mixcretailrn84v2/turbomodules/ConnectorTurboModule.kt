package com.impos2.mixcretailrn84v2.turbomodules

import android.view.KeyEvent
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.adapter.connector.ConnectorManager
import com.impos2.adapter.interfaces.ChannelDescriptor
import com.impos2.adapter.interfaces.ChannelType
import com.impos2.adapter.interfaces.ConnectorRequest
import com.impos2.adapter.interfaces.ConnectorResponse
import com.impos2.adapter.interfaces.InteractionMode
import com.impos2.mixcretailrn84v2.turbomodules.NativeConnectorTurboModuleSpec
import org.json.JSONObject

@ReactModule(name = ConnectorTurboModule.NAME)
class ConnectorTurboModule(reactContext: ReactApplicationContext) :
  NativeConnectorTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "ConnectorTurboModule"
    private const val EVENT_STREAM = "connector.stream"
    private const val EVENT_PASSIVE = "connector.passive"

    @Volatile
    private var instance: ConnectorTurboModule? = null

    fun onHostKeyEvent(event: KeyEvent): Boolean {
      return instance?.connector?.handleKeyEvent(event) ?: false
    }
  }

  internal val connector by lazy { ConnectorManager.getInstance(reactApplicationContext) }
  private var removeStreamListener: (() -> Unit)? = null
  private var removePassiveListener: (() -> Unit)? = null

  init {
    instance = this
    bindConnectorEvents()
  }

  override fun getName(): String = NAME

  @ReactMethod
  override fun call(
    channelJson: String,
    action: String,
    paramsJson: String,
    timeout: Double,
    promise: Promise,
  ) {
    val activity = currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve(
        toWritableMap(
          ConnectorResponse(
            success = false,
            code = 9999,
            message = "Activity not available",
            data = mapOf("error" to "ACTIVITY_NOT_AVAILABLE"),
          ),
        ),
      )
      return
    }

    runCatching {
      val request = ConnectorRequest(
        channel = parseChannel(channelJson),
        action = action,
        params = parseParams(paramsJson),
        timeoutMs = timeout.toLong(),
      )
      connector.call(activity, request) { response ->
        promise.resolve(toWritableMap(response))
      }
    }.onFailure {
      promise.reject("CONNECTOR_CALL_ERROR", it.message, it)
    }
  }

  @ReactMethod
  override fun subscribe(channelJson: String, promise: Promise) {
    runCatching {
      connector.subscribe(parseChannel(channelJson))
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("CONNECTOR_SUBSCRIBE_ERROR", it.message, it)
    }
  }

  @ReactMethod
  override fun unsubscribe(channelId: String, promise: Promise) {
    runCatching {
      connector.unsubscribe(channelId)
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("CONNECTOR_UNSUBSCRIBE_ERROR", it.message, it)
    }
  }

  @ReactMethod
  override fun isAvailable(channelJson: String, promise: Promise) {
    runCatching {
      connector.isAvailable(parseChannel(channelJson))
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.resolve(false)
    }
  }

  @ReactMethod
  override fun getAvailableTargets(type: String, promise: Promise) {
    runCatching {
      val channelType = ChannelType.valueOf(type)
      val targets = connector.getAvailableTargets(channelType)
      Arguments.createArray().apply {
        targets.forEach { pushString(it) }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("CONNECTOR_TARGETS_ERROR", it.message, it)
    }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  private fun bindConnectorEvents() {
    removeStreamListener?.invoke()
    removePassiveListener?.invoke()
    removeStreamListener = connector.onStream { event ->
      sendEvent(
        EVENT_STREAM,
        mapOf(
          "channelId" to event.channelId,
          "type" to event.type,
          "target" to event.target,
          "timestamp" to event.timestamp.toDouble(),
          "raw" to event.raw,
          "data" to event.data,
        ),
      )
    }
    removePassiveListener = connector.onPassive { event ->
      sendEvent(
        EVENT_PASSIVE,
        mapOf(
          "channelId" to event.channelId,
          "type" to event.type,
          "target" to event.target,
          "timestamp" to event.timestamp.toDouble(),
          "data" to event.data,
        ),
      )
    }
  }

  private fun parseChannel(channelJson: String): ChannelDescriptor {
    val json = JSONObject(channelJson)
    return ChannelDescriptor(
      type = ChannelType.valueOf(json.getString("type")),
      target = json.getString("target"),
      mode = InteractionMode.valueOf(json.getString("mode").replace('-', '_').uppercase()),
      options = parseOptions(json.optJSONObject("options")),
    )
  }

  private fun parseOptions(json: JSONObject?): Map<String, Any?> {
    if (json == null) return emptyMap()
    val result = mutableMapOf<String, Any?>()
    json.keys().forEach { key ->
      result[key] = json.opt(key)
    }
    return result
  }

  private fun parseParams(paramsJson: String): Map<String, Any?> {
    if (paramsJson.isBlank()) return emptyMap()
    val json = JSONObject(paramsJson)
    val result = mutableMapOf<String, Any?>()
    json.keys().forEach { key ->
      result[key] = json.opt(key)
    }
    return result
  }

  private fun toWritableMap(response: ConnectorResponse): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("success", response.success)
      putInt("code", response.code)
      putString("message", response.message)
      putDouble("timestamp", response.timestamp.toDouble())
      putDouble("duration", response.duration.toDouble())
      val data = response.data
      if (data == null) {
        putNull("data")
      } else {
        putMap("data", Arguments.createMap().apply {
          data.forEach { (key, value) ->
            when (value) {
              null -> putNull(key)
              is String -> putString(key, value)
              is Boolean -> putBoolean(key, value)
              is Int -> putInt(key, value)
              is Long -> putDouble(key, value.toDouble())
              is Double -> putDouble(key, value)
              else -> putString(key, value.toString())
            }
          }
        })
      }
    }
  }

  private fun sendEvent(eventName: String, params: Map<String, Any?>) {
    if (!reactApplicationContext.hasActiveReactInstance()) {
      return
    }
    val writableMap = toWritableMap(params)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, writableMap)
  }

  private fun toWritableMap(params: Map<String, Any?>): WritableMap {
    return Arguments.createMap().apply {
      params.forEach { (key, value) ->
        when (value) {
          null -> putNull(key)
          is String -> putString(key, value)
          is Boolean -> putBoolean(key, value)
          is Int -> putInt(key, value)
          is Long -> putDouble(key, value.toDouble())
          is Double -> putDouble(key, value)
          is Map<*, *> -> putMap(key, toWritableMap(value as Map<String, Any?>))
          is List<*> -> putArray(key, toWritableArray(value))
          else -> putString(key, value.toString())
        }
      }
    }
  }

  private fun toWritableArray(list: List<*>): WritableArray {
    return Arguments.createArray().apply {
      list.forEach { value ->
        when (value) {
          null -> pushNull()
          is String -> pushString(value)
          is Boolean -> pushBoolean(value)
          is Int -> pushInt(value)
          is Long -> pushDouble(value.toDouble())
          is Double -> pushDouble(value)
          is Map<*, *> -> pushMap(toWritableMap(value as Map<String, Any?>))
          is List<*> -> pushArray(toWritableArray(value))
          else -> pushString(value.toString())
        }
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    removeStreamListener?.invoke()
    removeStreamListener = null
    removePassiveListener?.invoke()
    removePassiveListener = null
    if (instance === this) {
      instance = null
    }
  }
}
