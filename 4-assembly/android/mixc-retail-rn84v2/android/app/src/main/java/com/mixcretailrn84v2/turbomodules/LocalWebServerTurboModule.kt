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
import com.impos2.mixcretailrn84v2.turbomodules.NativeLocalWebServerTurboModuleSpec
import org.json.JSONObject

@ReactModule(name = LocalWebServerTurboModule.NAME)
class LocalWebServerTurboModule(reactContext: ReactApplicationContext) :
  NativeLocalWebServerTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "LocalWebServerTurboModule"
  }

  private val webServer by lazy { LocalWebServerManager.getInstance(reactApplicationContext) }

  override fun getName(): String = NAME

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

  override fun stopLocalWebServer(promise: Promise) {
    runCatching {
      webServer.stop()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("STOP_LOCAL_WEB_SERVER_ERROR", it.message, it)
    }
  }

  override fun getLocalWebServerStatus(promise: Promise) {
    runCatching {
      toWritableMap(webServer.getStatus())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOCAL_WEB_SERVER_STATUS_ERROR", it.message, it)
    }
  }

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

  private fun parseConfig(configJson: String): LocalWebServerConfig {
    val json = JSONObject(configJson)
    return LocalWebServerConfig(
      port = json.optInt("port", 8888),
      basePath = json.optString("basePath", "/localServer"),
      heartbeatInterval = json.optLong("heartbeatInterval", 30_000L),
      heartbeatTimeout = json.optLong("heartbeatTimeout", 60_000L)
    )
  }

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

  private fun toWritableMap(address: ServerAddress): WritableMap {
    return Arguments.createMap().apply {
      putString("name", address.name)
      putString("address", address.address)
    }
  }

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
