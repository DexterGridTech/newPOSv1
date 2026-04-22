package com.impos2.mixcretailassemblyrn84.turbomodules

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
import com.impos2.adapterv2.connector.ConnectorManager
import com.impos2.adapterv2.interfaces.ChannelDescriptor
import com.impos2.adapterv2.interfaces.ChannelType
import com.impos2.adapterv2.interfaces.ConnectorRequest
import com.impos2.adapterv2.interfaces.ConnectorResponse
import com.impos2.adapterv2.interfaces.InteractionMode
import com.impos2.mixcretailassemblyrn84.turbomodules.NativeConnectorTurboModuleSpec
import org.json.JSONObject

/**
 * Connector TurboModule。
 *
 * 它把 adapter-android-v2 的 Connector 能力桥接到 JS，包括：
 * - 发起主动调用 `call`
 * - 建立订阅 `subscribe`
 * - 取消订阅 `unsubscribe`
 * - 查询通道可用性与可用目标
 * - 把 stream / passive 事件转成 JS 事件流
 * - 把宿主按键事件转交给 Connector 解析
 *
 * 由于很多 Connector 交互都需要宿主 Activity 参与（弹窗、扫码、文件选择等），所以这里的 `call`
 * 必须要求当前 Activity 是可用的 `FragmentActivity`。
 */
@ReactModule(name = ConnectorTurboModule.NAME)
class ConnectorTurboModule(reactContext: ReactApplicationContext) :
  NativeConnectorTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "ConnectorTurboModule"

    /**
     * 推送给 JS 的流式事件名。
     */
    private const val EVENT_STREAM = "connector.stream"

    /**
     * 推送给 JS 的被动事件名。
     */
    private const val EVENT_PASSIVE = "connector.passive"

    /**
     * 当前模块实例。
     *
     * 这里之所以保留静态引用，是为了让宿主 Activity 能把 `dispatchKeyEvent` 先转交给 Connector，
     * 再决定是否继续走系统默认分发。
     */
    @Volatile
    private var instance: ConnectorTurboModule? = null

    /**
     * 供宿主 Activity 调用的按键转发入口。
     */
    fun onHostKeyEvent(event: KeyEvent): Boolean {
      return instance?.connector?.handleKeyEvent(event) ?: false
    }
  }

  /**
   * adapter-android-v2 的 ConnectorManager 实例。
   */
  internal val connector by lazy { ConnectorManager.getInstance(reactApplicationContext) }

  /**
   * stream 事件解绑函数。
   */
  private var removeStreamListener: (() -> Unit)? = null

  /**
   * passive 事件解绑函数。
   */
  private var removePassiveListener: (() -> Unit)? = null

  init {
    instance = this
    bindConnectorEvents()
  }

  override fun getName(): String = NAME

  /**
   * 发起一次带宿主上下文的 Connector 调用。
   *
   * 如果当前 Activity 不可用，则返回一个统一结构的失败响应，而不是直接抛异常让 JS bridge 崩掉。
   */
  @ReactMethod
  override fun call(
    channelJson: String,
    action: String,
    paramsJson: String,
    timeout: Double,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
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

  /**
   * 建立订阅通道。
   */
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

  /**
   * 取消已建立的订阅。
   */
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

  /**
   * 查询某个通道当前是否可用。
   */
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

  /**
   * 查询某种通道类型下可用的 target 列表。
   */
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

  override fun invalidate() {
    removeStreamListener?.invoke()
    removeStreamListener = null
    removePassiveListener?.invoke()
    removePassiveListener = null
    if (instance === this) {
      instance = null
    }
    super.invalidate()
  }

  /**
   * 绑定 Connector 的流式事件与被动事件，并转发给 JS。
   */
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

  /**
   * 从 JS 传入的 JSON 构造强类型通道描述。
   */
  private fun parseChannel(channelJson: String): ChannelDescriptor {
    val json = JSONObject(channelJson)
    return ChannelDescriptor(
      type = ChannelType.valueOf(json.getString("type")),
      target = json.getString("target"),
      mode = InteractionMode.valueOf(json.getString("mode").replace('-', '_').uppercase()),
      options = parseOptions(json.optJSONObject("options")),
    )
  }

  /**
   * 把可选项 JSON 转成 Map。
   */
  private fun parseOptions(json: JSONObject?): Map<String, Any?> {
    if (json == null) return emptyMap()
    val result = mutableMapOf<String, Any?>()
    json.keys().forEach { key ->
      result[key] = json.opt(key)
    }
    return result
  }

  /**
   * 把参数 JSON 转成 Map。
   */
  private fun parseParams(paramsJson: String): Map<String, Any?> {
    if (paramsJson.isBlank()) return emptyMap()
    val json = JSONObject(paramsJson)
    val result = mutableMapOf<String, Any?>()
    json.keys().forEach { key ->
      result[key] = json.opt(key)
    }
    return result
  }

  /**
   * 把 ConnectorResponse 转成 JS 可消费的结构。
   */
  private fun toWritableMap(response: ConnectorResponse): WritableMap {
    val data = response.data
    return Arguments.createMap().apply {
      putBoolean("success", response.success)
      putInt("code", response.code)
      putString("message", response.message)
      if (data == null) {
        putNull("data")
      } else {
        putMap("data", toWritableMap(data))
      }
    }
  }

  /**
   * 把任意键值 Map 转成 WritableMap。
   */
  private fun toWritableMap(source: Map<String, Any?>): WritableMap {
    return Arguments.createMap().apply {
      source.forEach { (key, value) ->
        when (value) {
          null -> putNull(key)
          is String -> putString(key, value)
          is Boolean -> putBoolean(key, value)
          is Int -> putInt(key, value)
          is Double -> putDouble(key, value)
          is Float -> putDouble(key, value.toDouble())
          is Long -> putDouble(key, value.toDouble())
          is Map<*, *> -> putMap(key, toWritableMap(asStringAnyMap(value)))
          is List<*> -> putArray(key, toWritableArray(value))
          else -> putString(key, value.toString())
        }
      }
    }
  }

  /**
   * 把 List 转成 WritableArray。
   */
  private fun toWritableArray(source: List<*>): WritableArray {
    return Arguments.createArray().apply {
      source.forEach { value ->
        when (value) {
          null -> pushNull()
          is String -> pushString(value)
          is Boolean -> pushBoolean(value)
          is Int -> pushInt(value)
          is Double -> pushDouble(value)
          is Float -> pushDouble(value.toDouble())
          is Long -> pushDouble(value.toDouble())
          is Map<*, *> -> pushMap(toWritableMap(asStringAnyMap(value)))
          is List<*> -> pushArray(toWritableArray(value))
          else -> pushString(value.toString())
        }
      }
    }
  }

  /**
   * 把运行时拿到的任意 Map 收敛成 `Map<String, Any?>`。
   *
   * Connector 事件数据来自跨模块对象，Kotlin 在这里无法静态证明 key 一定是 String，
   * 因此通过受控转换统一兜底；非字符串 key 会被转成字符串，避免直接做不安全 cast。
   */
  private fun asStringAnyMap(source: Map<*, *>): Map<String, Any?> {
    val result = linkedMapOf<String, Any?>()
    source.forEach { (key, value) ->
      result[key?.toString() ?: "null"] = value
    }
    return result
  }

  /**
   * 向 JS 发事件。
   */
  private fun sendEvent(eventName: String, payload: Map<String, Any?>) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, toWritableMap(payload))
  }
}
