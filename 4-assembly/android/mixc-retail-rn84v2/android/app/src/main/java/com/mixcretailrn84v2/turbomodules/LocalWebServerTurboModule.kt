package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapter.interfaces.LocalWebServerConfig
import com.impos2.adapter.interfaces.LocalWebServerInfo
import com.impos2.adapter.interfaces.ServerAddress
import com.impos2.adapter.interfaces.ServerStats
import com.impos2.adapter.webserver.LocalWebServerManager
import org.json.JSONObject

/**
 * LocalWebServer TurboModule。
 *
 * 负责把 adapterPure 的本地 web server 能力暴露给 JS。整合层本身不重新实现 web server，
 * 这里只做三件事：
 * - 解析 JS 下发的配置；
 * - 调用 manager 执行 start / stop / status / stats；
 * - 把返回结果标准化成 JS 结构。
 */
@ReactModule(name = LocalWebServerTurboModule.NAME)
class LocalWebServerTurboModule(reactContext: ReactApplicationContext) :
  NativeLocalWebServerTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "LocalWebServerTurboModule"
  }

  /**
   * 底层 local web server 管理器。
   */
  private val webServer by lazy { LocalWebServerManager.getInstance(reactApplicationContext) }

  override fun getName(): String = NAME

  /**
   * 按传入配置启动 local web server，并返回启动后的最新状态。
   */
  override fun startLocalWebServer(configJson: String, promise: Promise) {
    runCatching {
      val config = parseConfig(configJson)
      webServer.start(config)
      toWritableMap(webServer.getStatus())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("START_LOCAL_WEB_SERVER_ERROR", it.message, it)
    }
  }

  /**
   * 停止 local web server。
   */
  override fun stopLocalWebServer(promise: Promise) {
    runCatching {
      webServer.stop()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("STOP_LOCAL_WEB_SERVER_ERROR", it.message, it)
    }
  }

  /**
   * 获取 local web server 当前状态。
   */
  override fun getLocalWebServerStatus(promise: Promise) {
    runCatching {
      toWritableMap(webServer.getStatus())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOCAL_WEB_SERVER_STATUS_ERROR", it.message, it)
    }
  }

  /**
   * 获取 local web server 统计信息。
   */
  override fun getLocalWebServerStats(promise: Promise) {
    runCatching {
      toWritableMap(webServer.getStats())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOCAL_WEB_SERVER_STATS_ERROR", it.message, it)
    }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  /**
   * 从 JS 传入的 JSON 解析出强类型配置。
   */
  private fun parseConfig(configJson: String): LocalWebServerConfig {
    val json = JSONObject(configJson)
    return LocalWebServerConfig(
      port = json.optInt("port", 8888),
      basePath = json.optString("basePath", "/localServer"),
      heartbeatInterval = json.optLong("heartbeatInterval", 30_000L),
      heartbeatTimeout = json.optLong("heartbeatTimeout", 60_000L)
    )
  }

  /**
   * 把状态对象转成 JS 结构。
   */
  private fun toWritableMap(info: LocalWebServerInfo): WritableMap {
    return Arguments.createMap().apply {
      putString("status", info.status.name)
      putArray("addresses", Arguments.createArray().apply {
        info.addresses.forEach { pushMap(toWritableMap(it)) }
      })
      putMap("config", Arguments.createMap().apply {
        putInt("port", info.config.port)
        putString("basePath", info.config.basePath)
        putDouble("heartbeatInterval", info.config.heartbeatInterval.toDouble())
        putDouble("heartbeatTimeout", info.config.heartbeatTimeout.toDouble())
      })
      if (info.error == null) putNull("error") else putString("error", info.error)
    }
  }

  /**
   * 把单个服务地址信息转成 JS 结构。
   */
  private fun toWritableMap(address: ServerAddress): WritableMap {
    return Arguments.createMap().apply {
      putString("name", address.name)
      putString("address", address.address)
    }
  }

  /**
   * 把服务统计信息转成 JS 结构。
   */
  private fun toWritableMap(stats: ServerStats): WritableMap {
    return Arguments.createMap().apply {
      putInt("masterCount", stats.masterCount)
      putInt("slaveCount", stats.slaveCount)
      putInt("pendingCount", stats.pendingCount)
      putDouble("uptime", stats.uptime.toDouble())
      putDouble("requestCount", stats.requestCount.toDouble())
    }
  }
}
