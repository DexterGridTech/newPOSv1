package com.impos2.adapterv2.topologyhostv3

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal object TopologyHostV3Ids {
  fun createSessionId(): String = "v3ses_${createPayload()}"
  fun createConnectionId(): String = "v3con_${createPayload()}"
  fun createRuleId(): String = "v3rule_${createPayload()}"

  private fun createPayload(): String {
    return "${System.currentTimeMillis().toString(36)}_${UUID.randomUUID().toString().replace("-", "").take(8)}"
  }
}

internal fun JSONObject.optStringOrNull(key: String): String? {
  return if (has(key) && !isNull(key)) optString(key) else null
}

internal fun JSONObject.optLongOrNull(key: String): Long? {
  return if (has(key) && !isNull(key)) optLong(key) else null
}

internal fun JSONObject.optJsonObject(key: String): JSONObject? {
  return if (has(key) && !isNull(key)) optJSONObject(key) else null
}

internal fun JSONObject.optJsonArray(key: String): JSONArray? {
  return if (has(key) && !isNull(key)) optJSONArray(key) else null
}

internal fun JSONArray.toStringList(): List<String> {
  val result = mutableListOf<String>()
  for (index in 0 until length()) {
    result += optString(index)
  }
  return result
}

internal fun List<String>.toJsonStringArray(): JSONArray {
  return JSONArray().also { array ->
    forEach { array.put(it) }
  }
}

internal fun List<TopologyHostV3FaultRule>.toFaultRuleJsonArray(): JSONArray {
  return JSONArray().also { array ->
    forEach { array.put(it.toJson()) }
  }
}

internal fun TopologyHostV3RuntimeInfo.toJson(): JSONObject {
  return JSONObject()
    .put("nodeId", nodeId)
    .put("deviceId", deviceId)
    .put("instanceMode", instanceMode)
    .put("displayMode", displayMode)
    .put("standalone", standalone)
    .put("protocolVersion", protocolVersion)
    .put("capabilities", capabilities.toJsonStringArray())
}

internal fun JSONObject.toTopologyHostV3RuntimeInfo(): TopologyHostV3RuntimeInfo {
  return TopologyHostV3RuntimeInfo(
    nodeId = optString("nodeId"),
    deviceId = optString("deviceId"),
    instanceMode = optString("instanceMode"),
    displayMode = optString("displayMode"),
    standalone = optBoolean("standalone"),
    protocolVersion = optString("protocolVersion"),
    capabilities = optJsonArray("capabilities")?.toStringList() ?: emptyList(),
  )
}

internal fun JSONObject.toTopologyHostV3Hello(): TopologyHostV3Hello {
  return TopologyHostV3Hello(
    helloId = optString("helloId"),
    runtime = optJsonObject("runtime")?.toTopologyHostV3RuntimeInfo()
      ?: throw IllegalArgumentException("runtime is required"),
    sentAt = optLong("sentAt"),
  )
}

internal fun TopologyHostV3HelloAck.toJson(): JSONObject {
  val json = JSONObject()
    .put("type", "hello-ack")
    .put("helloId", helloId)
    .put("accepted", accepted)
    .put("hostTime", hostTime)
  sessionId?.let { json.put("sessionId", it) }
  peerRuntime?.let { json.put("peerRuntime", it.toJson()) }
  rejectionCode?.let { json.put("rejectionCode", it) }
  rejectionMessage?.let { json.put("rejectionMessage", it) }
  return json
}

internal fun JSONObject.toTopologyHostV3FaultRule(): TopologyHostV3FaultRule {
  return TopologyHostV3FaultRule(
    ruleId = optStringOrNull("ruleId") ?: TopologyHostV3Ids.createRuleId(),
    kind = optString("kind"),
    channel = optStringOrNull("channel"),
    delayMs = optLongOrNull("delayMs"),
  )
}

internal fun TopologyHostV3FaultRule.toJson(): JSONObject {
  val json = JSONObject()
    .put("ruleId", ruleId)
    .put("kind", kind)
  channel?.let { json.put("channel", it) }
  delayMs?.let { json.put("delayMs", it) }
  return json
}

fun TopologyHostV3AddressInfo.toJson(): JSONObject {
  return JSONObject()
    .put("host", host)
    .put("port", port)
    .put("basePath", basePath)
    .put("httpBaseUrl", httpBaseUrl)
    .put("wsUrl", wsUrl)
}

fun TopologyHostV3Stats.toJson(): JSONObject {
  return JSONObject()
    .put("sessionCount", sessionCount)
    .put("peerCount", peerCount)
    .put("stalePeerCount", stalePeerCount)
    .put("activeFaultRuleCount", activeFaultRuleCount)
}

fun TopologyHostV3StatusInfo.toJson(): JSONObject {
  val json = JSONObject()
    .put("state", state.name)
    .put("config", JSONObject()
      .put("port", config.port)
      .put("basePath", config.basePath),
    )
  addressInfo?.let { json.put("addressInfo", it.toJson()) }
  error?.let { json.put("error", it) }
  return json
}

fun TopologyHostV3DiagnosticsSnapshot.toJson(): JSONObject {
  val json = JSONObject()
    .put("moduleName", moduleName)
    .put("state", state)
    .put("sessionId", sessionId)
  hostRuntime?.let { json.put("hostRuntime", it.toJson()) }
  json.put("peers", JSONArray().also { array ->
    peers.forEach { peer ->
      array.put(JSONObject()
        .put("role", peer.role)
        .put("nodeId", peer.nodeId)
        .put("deviceId", peer.deviceId)
        .put("lastSeenAt", peer.lastSeenAt)
        .put("lastHeartbeatSentAt", peer.lastHeartbeatSentAt)
        .put("stale", peer.stale),
      )
    }
  })
  json.put("faultRules", faultRules.toFaultRuleJsonArray())
  return json
}
