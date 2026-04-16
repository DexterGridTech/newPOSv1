package com.impos2.adapterv2.topologyhost

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal object TopologyHostIds {
  fun createSessionId(): String = "hses_${createPayload()}"
  fun createConnectionId(): String = "hcon_${createPayload()}"
  fun createEnvelopeId(): String = "henv_${createPayload()}"
  fun createObservationId(): String = "hobs_${createPayload()}"
  fun createRuleId(): String = "hrule_${createPayload()}"

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

internal fun JSONObject.optIntOrNull(key: String): Int? {
  return if (has(key) && !isNull(key)) optInt(key) else null
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

internal fun JSONArray.toJsonObjectList(): List<JSONObject> {
  val result = mutableListOf<JSONObject>()
  for (index in 0 until length()) {
    result += (get(index) as? JSONObject ?: JSONObject())
  }
  return result
}

internal fun List<String>.toJsonStringArray(): JSONArray {
  return JSONArray().also { array ->
    forEach { array.put(it) }
  }
}

internal fun List<JSONObject>.toJsonObjectArray(): JSONArray {
  return JSONArray().also { array ->
    forEach { array.put(it) }
  }
}

internal fun TopologyHostRuntimeInfo.toJson(): JSONObject {
  return JSONObject()
    .put("nodeId", nodeId)
    .put("deviceId", deviceId)
    .put("role", role)
    .put("platform", platform)
    .put("product", product)
    .put("assemblyAppId", assemblyAppId)
    .put("assemblyVersion", assemblyVersion)
    .put("buildNumber", buildNumber)
    .put("bundleVersion", bundleVersion)
    .put("runtimeVersion", runtimeVersion)
    .put("protocolVersion", protocolVersion)
    .put("capabilities", capabilities.toJsonStringArray())
}

internal fun JSONObject.toTopologyHostRuntimeInfo(): TopologyHostRuntimeInfo {
  return TopologyHostRuntimeInfo(
    nodeId = optString("nodeId"),
    deviceId = optString("deviceId"),
    role = optString("role"),
    platform = optString("platform"),
    product = optString("product"),
    assemblyAppId = optString("assemblyAppId"),
    assemblyVersion = optString("assemblyVersion"),
    buildNumber = optLong("buildNumber"),
    bundleVersion = optString("bundleVersion"),
    runtimeVersion = optString("runtimeVersion"),
    protocolVersion = optString("protocolVersion"),
    capabilities = optJsonArray("capabilities")?.toStringList() ?: emptyList(),
  )
}

internal fun TopologyHostCompatibilityDecision.toJson(): JSONObject {
  return JSONObject()
    .put("level", level)
    .put("reasons", reasons.toJsonStringArray())
    .put("enabledCapabilities", enabledCapabilities.toJsonStringArray())
    .put("disabledCapabilities", disabledCapabilities.toJsonStringArray())
}

internal fun TopologyHostPairingTicket.toJson(): JSONObject {
  return JSONObject()
    .put("token", token)
    .put("masterNodeId", masterNodeId)
    .put("transportUrls", transportUrls.toJsonStringArray())
    .put("issuedAt", issuedAt)
    .put("expiresAt", expiresAt)
    .put("hostRuntime", hostRuntime.toJson())
}

internal fun TopologyHostNodeHelloAck.toJson(): JSONObject {
  val json = JSONObject()
    .put("helloId", helloId)
    .put("accepted", accepted)
    .put("compatibility", compatibility.toJson())
    .put("hostTime", hostTime)
  sessionId?.let { json.put("sessionId", it) }
  peerRuntime?.let { json.put("peerRuntime", it.toJson()) }
  rejectionCode?.let { json.put("rejectionCode", it) }
  rejectionMessage?.let { json.put("rejectionMessage", it) }
  return json
}

internal fun JSONObject.toTopologyHostNodeHello(): TopologyHostNodeHello {
  return TopologyHostNodeHello(
    helloId = optString("helloId"),
    ticketToken = optString("ticketToken"),
    runtime = optJsonObject("runtime")?.toTopologyHostRuntimeInfo()
      ?: throw IllegalArgumentException("runtime is required"),
    sentAt = optLong("sentAt"),
  )
}

internal fun TopologyHostTicketResponse.toJson(): JSONObject {
  val json = JSONObject().put("success", success)
  token?.let { json.put("token", it) }
  sessionId?.let { json.put("sessionId", it) }
  expiresAt?.let { json.put("expiresAt", it) }
  transportUrls?.let { json.put("transportUrls", it.toJsonStringArray()) }
  error?.let { json.put("error", it) }
  return json
}

internal fun TopologyHostFaultRule.toJson(): JSONObject {
  val json = JSONObject()
    .put("kind", kind)
    .put("ruleId", ruleId)
    .put("createdAt", createdAt)
  remainingHits?.let { json.put("remainingHits", it) }
  sessionId?.let { json.put("sessionId", it) }
  targetRole?.let { json.put("targetRole", it) }
  sourceNodeId?.let { json.put("sourceNodeId", it) }
  targetNodeId?.let { json.put("targetNodeId", it) }
  channel?.let { json.put("channel", it) }
  delayMs?.let { json.put("delayMs", it) }
  rejectionCode?.let { json.put("rejectionCode", it) }
  rejectionMessage?.let { json.put("rejectionMessage", it) }
  return json
}

internal fun JSONObject.toTopologyHostFaultRule(): TopologyHostFaultRule {
  return TopologyHostFaultRule(
    kind = optString("kind"),
    ruleId = optStringOrNull("ruleId") ?: TopologyHostIds.createRuleId(),
    remainingHits = optIntOrNull("remainingHits"),
    createdAt = optLongOrNull("createdAt") ?: System.currentTimeMillis(),
    sessionId = optStringOrNull("sessionId"),
    targetRole = optStringOrNull("targetRole"),
    sourceNodeId = optStringOrNull("sourceNodeId"),
    targetNodeId = optStringOrNull("targetNodeId"),
    channel = optStringOrNull("channel"),
    delayMs = optLongOrNull("delayMs"),
    rejectionCode = optStringOrNull("rejectionCode"),
    rejectionMessage = optStringOrNull("rejectionMessage"),
  )
}

internal fun List<TopologyHostFaultRule>.toFaultRuleJsonArray(): JSONArray {
  return JSONArray().also { array ->
    forEach { array.put(it.toJson()) }
  }
}

internal fun TopologyHostRelayCounters.toJson(): JSONObject {
  return JSONObject()
    .put("enqueued", enqueued)
    .put("delivered", delivered)
    .put("dropped", dropped)
    .put("flushed", flushed)
    .put("disconnected", disconnected)
}

fun TopologyHostStats.toJson(): JSONObject {
  return JSONObject()
    .put("ticketCount", ticketCount)
    .put("sessionCount", sessionCount)
    .put("relayCounters", relayCounters.toJson())
    .put("activeFaultRuleCount", activeFaultRuleCount)
    .put("activeConnectionCount", activeConnectionCount)
}

fun TopologyHostAddressInfo.toJson(): JSONObject {
  return JSONObject()
    .put("host", host)
    .put("port", port)
    .put("basePath", basePath)
    .put("httpBaseUrl", httpBaseUrl)
    .put("wsUrl", wsUrl)
}

fun TopologyHostStatusInfo.toJson(): JSONObject {
  val json = JSONObject()
    .put("state", state.name)
    .put("config", JSONObject()
      .put("port", config.port)
      .put("basePath", config.basePath)
      .put("heartbeatIntervalMs", config.heartbeatIntervalMs)
      .put("heartbeatTimeoutMs", config.heartbeatTimeoutMs)
      .put("defaultTicketExpiresInMs", config.defaultTicketExpiresInMs),
    )
  addressInfo?.let { json.put("addressInfo", it.toJson()) }
  error?.let { json.put("error", it) }
  return json
}

internal fun TopologyHostObservationEvent.toJson(): JSONObject {
  val json = JSONObject()
    .put("observationId", observationId)
    .put("timestamp", timestamp)
    .put("level", level)
    .put("category", category)
    .put("event", event)
  message?.let { json.put("message", it) }
  sessionId?.let { json.put("sessionId", it) }
  nodeId?.let { json.put("nodeId", it) }
  connectionId?.let { json.put("connectionId", it) }
  data?.let { json.put("data", it) }
  return json
}

fun TopologyHostDiagnosticsSnapshot.toJson(): JSONObject {
  return JSONObject()
    .put("hostRuntime", hostRuntime.toJson())
    .put("tickets", JSONArray().also { array -> tickets.forEach { array.put(it.ticket.toJson()) } })
    .put("sessions", JSONArray().also { array ->
      sessions.forEach { session ->
        array.put(
          JSONObject()
            .put("sessionId", session.sessionId)
            .put("token", session.token)
            .put("status", session.status)
            .put("createdAt", session.createdAt)
            .put("updatedAt", session.updatedAt)
            .put("relayPendingCount", session.relayPendingCount)
            .put("compatibility", session.compatibility.toJson())
            .put("resume", JSONObject()
              .put("phase", session.resume.phase)
              .put("pendingNodeIds", session.resume.pendingNodeIds.toJsonStringArray())
              .put("requiredAt", session.resume.requiredAt)
              .put("startedAt", session.resume.startedAt)
              .put("completedAt", session.resume.completedAt)
              .put("reason", session.resume.reason),
            )
            .put("nodes", JSONObject().also { nodesJson ->
              session.nodes.forEach { (nodeId, node) ->
                nodesJson.put(nodeId, JSONObject()
                  .put("nodeId", node.nodeId)
                  .put("role", node.role)
                  .put("runtime", node.runtime.toJson())
                  .put("lastHelloAt", node.lastHelloAt)
                  .put("connected", node.connected)
                  .put("connectionId", node.connectionId)
                  .put("connectedAt", node.connectedAt)
                  .put("disconnectedAt", node.disconnectedAt)
                  .put("lastHeartbeatAt", node.lastHeartbeatAt),
                )
              }
            }),
        )
      }
    })
    .put("relayCounters", relayCounters.toJson())
    .put("activeFaultRules", activeFaultRules.toFaultRuleJsonArray())
    .put("recentEvents", JSONArray().also { array -> recentEvents.forEach { array.put(it.toJson()) } })
}
