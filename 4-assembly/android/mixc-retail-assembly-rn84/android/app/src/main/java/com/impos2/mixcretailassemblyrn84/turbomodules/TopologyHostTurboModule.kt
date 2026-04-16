package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.topologyhost.TopologyHostConfig
import com.impos2.adapterv2.topologyhost.TopologyHostFaultRule
import com.impos2.adapterv2.topologyhost.TopologyHostManager
import com.impos2.adapterv2.topologyhost.toJson
import com.impos2.mixcretailassemblyrn84.startup.TopologyLaunchCoordinator
import org.json.JSONArray
import org.json.JSONObject

@ReactModule(name = TopologyHostTurboModule.NAME)
class TopologyHostTurboModule(reactContext: ReactApplicationContext) :
  NativeTopologyHostTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "TopologyHostTurboModule"
  }

  private val manager by lazy { TopologyHostManager.getInstance(reactApplicationContext.applicationContext) }

  override fun getName(): String = NAME

  override fun startTopologyHost(configJson: String, promise: Promise) {
    runCatching {
      val json = if (configJson.isBlank()) JSONObject() else JSONObject(configJson)
      val address = manager.start(
        TopologyHostConfig(
          port = json.optInt("port", com.impos2.adapterv2.topologyhost.TopologyHostDefaults.DEFAULT_PORT),
          basePath = json.optString("basePath", com.impos2.adapterv2.topologyhost.TopologyHostDefaults.DEFAULT_BASE_PATH),
          heartbeatIntervalMs = json.optLong("heartbeatIntervalMs", com.impos2.adapterv2.topologyhost.TopologyHostDefaults.DEFAULT_HEARTBEAT_INTERVAL_MS),
          heartbeatTimeoutMs = json.optLong("heartbeatTimeoutMs", com.impos2.adapterv2.topologyhost.TopologyHostDefaults.DEFAULT_HEARTBEAT_TIMEOUT_MS),
          defaultTicketExpiresInMs = json.optLong("defaultTicketExpiresInMs", com.impos2.adapterv2.topologyhost.TopologyHostDefaults.DEFAULT_TICKET_EXPIRES_IN_MS),
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
          .put("ticketToken", prepared.ticketToken)
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
            TopologyHostFaultRule(
              kind = json.getString("kind"),
              ruleId = json.optString("ruleId").ifBlank { "rule-$index" },
              remainingHits = if (json.has("remainingHits")) json.optInt("remainingHits") else null,
              createdAt = if (json.has("createdAt")) json.optLong("createdAt") else System.currentTimeMillis(),
              sessionId = json.optString("sessionId").ifBlank { null },
              targetRole = json.optString("targetRole").ifBlank { null },
              sourceNodeId = json.optString("sourceNodeId").ifBlank { null },
              targetNodeId = json.optString("targetNodeId").ifBlank { null },
              channel = json.optString("channel").ifBlank { null },
              delayMs = if (json.has("delayMs")) json.optLong("delayMs") else null,
              rejectionCode = json.optString("rejectionCode").ifBlank { null },
              rejectionMessage = json.optString("rejectionMessage").ifBlank { null },
            )
          })
        }
      }
      JSONObject()
        .put("success", manager.replaceFaultRules(rules).success)
        .put("ruleCount", rules.size)
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
