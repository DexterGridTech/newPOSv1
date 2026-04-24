package com.next.hostruntimern84.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.next.adapterv2.topologyhostv3.TopologyHostV3Config
import com.next.adapterv2.topologyhostv3.TopologyHostV3FaultRule
import com.next.adapterv2.topologyhostv3.TopologyHostV3Manager
import com.next.adapterv2.topologyhostv3.toJson
import com.next.hostruntimern84.startup.TopologyLaunchCoordinator
import org.json.JSONArray
import org.json.JSONObject

@ReactModule(name = TopologyHostTurboModule.NAME)
class TopologyHostTurboModule(reactContext: ReactApplicationContext) :
  NativeTopologyHostTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "TopologyHostTurboModule"
  }

  private val manager by lazy { TopologyHostV3Manager.getInstance(reactApplicationContext.applicationContext) }

  override fun getName(): String = NAME

  override fun startTopologyHost(configJson: String, promise: Promise) {
    runCatching {
      val json = if (configJson.isBlank()) JSONObject() else JSONObject(configJson)
      val address = manager.start(
        TopologyHostV3Config(
          port = json.optInt("port", com.next.adapterv2.topologyhostv3.TopologyHostV3Defaults.DEFAULT_PORT),
          basePath = json.optString("basePath", com.next.adapterv2.topologyhostv3.TopologyHostV3Defaults.DEFAULT_BASE_PATH),
        ),
      )
      address.toJson().toString()
    }.onSuccess {
      promise.resolve(JSONObject(it).toString())
    }.onFailure {
      promise.reject("TOPOLOGY_HOST_ERROR", it.message, it)
    }
  }

  override fun prepareTopologyLaunch(displayCount: Double, promise: Promise) {
    runCatching {
      val prepared = TopologyLaunchCoordinator.prepare(
        reactApplicationContext.applicationContext,
        displayCount.toInt(),
      )
      if (prepared == null) {
        JSONObject()
      } else {
        JSONObject()
          .put("masterNodeId", prepared.masterNodeId)
          .put("masterDeviceId", prepared.masterDeviceId)
          .put("wsUrl", prepared.wsUrl)
          .put("httpBaseUrl", prepared.httpBaseUrl)
      }
    }.onSuccess {
      promise.resolve(it.toString())
    }.onFailure {
      promise.reject("TOPOLOGY_HOST_ERROR", it.message, it)
    }
  }

  override fun stopTopologyHost(promise: Promise) {
    runCatching { manager.stop() }
      .onSuccess { promise.resolve(null) }
      .onFailure { promise.reject("TOPOLOGY_HOST_ERROR", it.message, it) }
  }

  override fun getTopologyHostStatus(promise: Promise) {
    runCatching { manager.getStatus().toJson().toString() }
      .onSuccess { promise.resolve(it) }
      .onFailure { promise.reject("TOPOLOGY_HOST_ERROR", it.message, it) }
  }

  override fun getTopologyHostStats(promise: Promise) {
    runCatching { manager.getStats().toJson().toString() }
      .onSuccess { promise.resolve(it) }
      .onFailure { promise.reject("TOPOLOGY_HOST_ERROR", it.message, it) }
  }

  override fun replaceTopologyFaultRules(rulesJson: String, promise: Promise) {
    runCatching {
      val rulesArray = if (rulesJson.isBlank()) JSONArray() else JSONArray(rulesJson)
      val rules = buildList {
        for (index in 0 until rulesArray.length()) {
          add((rulesArray.getJSONObject(index)).let { json ->
            TopologyHostV3FaultRule(
              kind = json.getString("kind"),
              ruleId = json.optString("ruleId").ifBlank { "rule-$index" },
              channel = json.optString("channel").ifBlank { null },
              delayMs = if (json.has("delayMs")) json.optLong("delayMs") else null,
            )
          })
        }
      }
      val appliedRuleCount = manager.replaceFaultRules(rules)
      JSONObject()
        .put("success", true)
        .put("ruleCount", appliedRuleCount)
        .toString()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("TOPOLOGY_HOST_ERROR", it.message, it)
    }
  }

  override fun getDiagnosticsSnapshot(promise: Promise) {
    runCatching { manager.getDiagnosticsSnapshot()?.toJson()?.toString() }
      .onSuccess { promise.resolve(it) }
      .onFailure { promise.reject("TOPOLOGY_HOST_ERROR", it.message, it) }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit
}
