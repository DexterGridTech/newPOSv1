package com.impos2.adapterv2.topologyhost

import org.json.JSONObject

const val TOPOLOGY_HOST_MODULE_NAME = "adapter.android.topology-host-v2"

/**
 * 内置双屏 host 的默认参数。
 *
 * 这些默认值直接对齐当前 mock topology host，避免终端内置 host 与 mock host
 * 在协议入口层面出现不必要分叉。
 */
object TopologyHostDefaults {
  const val DEFAULT_PORT = 8888
  const val DEFAULT_BASE_PATH = "/mockMasterServer"
  const val DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000L
  const val DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000L
  const val DEFAULT_TICKET_EXPIRES_IN_MS = 5 * 60 * 1000L
  const val DEFAULT_RUNTIME_VERSION = "android-topology-host-v1"
  const val DEFAULT_PROTOCOL_VERSION = "2026.04"
}

enum class TopologyHostServiceState {
  STOPPED,
  STARTING,
  RUNNING,
  STOPPING,
  ERROR,
}

data class TopologyHostConfig(
  val port: Int = TopologyHostDefaults.DEFAULT_PORT,
  val basePath: String = TopologyHostDefaults.DEFAULT_BASE_PATH,
  val heartbeatIntervalMs: Long = TopologyHostDefaults.DEFAULT_HEARTBEAT_INTERVAL_MS,
  val heartbeatTimeoutMs: Long = TopologyHostDefaults.DEFAULT_HEARTBEAT_TIMEOUT_MS,
  val defaultTicketExpiresInMs: Long = TopologyHostDefaults.DEFAULT_TICKET_EXPIRES_IN_MS,
)

data class TopologyHostAddressInfo(
  val host: String,
  val port: Int,
  val basePath: String,
  val httpBaseUrl: String,
  val wsUrl: String,
)

data class TopologyHostStats(
  val ticketCount: Int = 0,
  val sessionCount: Int = 0,
  val relayCounters: TopologyHostRelayCounters = TopologyHostRelayCounters(),
  val activeFaultRuleCount: Int = 0,
  val activeConnectionCount: Int = 0,
)

data class TopologyHostStatusInfo(
  val state: TopologyHostServiceState,
  val addressInfo: TopologyHostAddressInfo?,
  val config: TopologyHostConfig,
  val error: String? = null,
)

data class TopologyHostRuntimeInfo(
  val nodeId: String,
  val deviceId: String,
  val role: String,
  val platform: String,
  val product: String,
  val assemblyAppId: String,
  val assemblyVersion: String,
  val buildNumber: Long,
  val bundleVersion: String,
  val runtimeVersion: String,
  val protocolVersion: String,
  val capabilities: List<String>,
)

data class TopologyHostCompatibilityDecision(
  val level: String,
  val reasons: List<String>,
  val enabledCapabilities: List<String>,
  val disabledCapabilities: List<String>,
)

data class TopologyHostPairingTicket(
  val token: String,
  val masterNodeId: String,
  val transportUrls: List<String>,
  val issuedAt: Long,
  val expiresAt: Long,
  val hostRuntime: TopologyHostRuntimeInfo,
)

data class TopologyHostNodeHello(
  val helloId: String,
  val ticketToken: String,
  val runtime: TopologyHostRuntimeInfo,
  val sentAt: Long,
)

data class TopologyHostNodeHelloAck(
  val helloId: String,
  val accepted: Boolean,
  val sessionId: String? = null,
  val peerRuntime: TopologyHostRuntimeInfo? = null,
  val compatibility: TopologyHostCompatibilityDecision,
  val rejectionCode: String? = null,
  val rejectionMessage: String? = null,
  val hostTime: Long,
)

data class TopologyHostTicketResponse(
  val success: Boolean,
  val token: String? = null,
  val sessionId: String? = null,
  val expiresAt: Long? = null,
  val transportUrls: List<String>? = null,
  val error: String? = null,
)

data class TopologyHostFaultRule(
  val kind: String,
  val ruleId: String,
  val remainingHits: Int? = null,
  val createdAt: Long = System.currentTimeMillis(),
  val sessionId: String? = null,
  val targetRole: String? = null,
  val sourceNodeId: String? = null,
  val targetNodeId: String? = null,
  val channel: String? = null,
  val delayMs: Long? = null,
  val rejectionCode: String? = null,
  val rejectionMessage: String? = null,
)

data class TopologyHostFaultRuleReplaceResponse(
  val success: Boolean,
  val ruleCount: Int,
)

internal data class TopologyHostFaultMatch(
  val ruleIds: List<String> = emptyList(),
  val delayMs: Long? = null,
  val dropCurrentRelay: Boolean = false,
  val disconnectTarget: Boolean = false,
  val rejectionCode: String? = null,
  val rejectionMessage: String? = null,
)

internal data class TopologyHostHelloResult(
  val ack: TopologyHostNodeHelloAck,
  val delayMs: Long? = null,
  val faultRuleIds: List<String> = emptyList(),
)

data class TopologyHostTicketOccupancy(
  val role: String,
  val nodeId: String,
  val sessionId: String,
  val connected: Boolean,
  val updatedAt: Long,
)

data class TopologyHostTicketRecord(
  val ticket: TopologyHostPairingTicket,
  var sessionId: String? = null,
  val occupiedRoles: MutableMap<String, TopologyHostTicketOccupancy> = mutableMapOf(),
  var updatedAt: Long = ticket.issuedAt,
)

data class TopologyHostSessionNodeRecord(
  val nodeId: String,
  val role: String,
  var runtime: TopologyHostRuntimeInfo,
  var lastHelloAt: Long,
  var connected: Boolean,
  var connectionId: String? = null,
  var connectedAt: Long? = null,
  var disconnectedAt: Long? = null,
  var lastHeartbeatAt: Long? = null,
)

data class TopologyHostResumeState(
  var phase: String = "idle",
  val pendingNodeIds: MutableList<String> = mutableListOf(),
  var requiredAt: Long? = null,
  var startedAt: Long? = null,
  var completedAt: Long? = null,
  var reason: String? = null,
)

data class TopologyHostSessionRecord(
  val sessionId: String,
  val token: String,
  val ticket: TopologyHostPairingTicket,
  var status: String,
  var compatibility: TopologyHostCompatibilityDecision,
  val createdAt: Long,
  var updatedAt: Long,
  val nodes: MutableMap<String, TopologyHostSessionNodeRecord>,
  var relayPendingCount: Int = 0,
  val resume: TopologyHostResumeState = TopologyHostResumeState(),
)

internal data class TopologyHostConnectionRecord(
  val sessionId: String,
  val nodeId: String,
  val connectionId: String,
  val connectedAt: Long,
  var lastHeartbeatAt: Long,
)

internal enum class TopologyHostRelayChannel {
  DISPATCH,
  EVENT,
  PROJECTION,
  RESUME,
}

internal data class TopologyHostRelayDelivery(
  val relayId: String,
  val sessionId: String,
  val channel: TopologyHostRelayChannel,
  val sourceNodeId: String,
  val targetNodeId: String,
  val connectionId: String,
  val sequence: Int,
  val availableAt: Long,
  val envelope: JSONObject,
)

data class TopologyHostRelayCounters(
  val enqueued: Int = 0,
  val delivered: Int = 0,
  val dropped: Int = 0,
  val flushed: Int = 0,
  val disconnected: Int = 0,
)

internal data class TopologyHostRelayResult(
  val channel: TopologyHostRelayChannel,
  val deliveries: List<TopologyHostRelayDelivery> = emptyList(),
  val queuedForOfflinePeer: Boolean = false,
  val dropped: Boolean = false,
  val disconnectedConnectionIds: List<String> = emptyList(),
  val effect: TopologyHostFaultMatch = TopologyHostFaultMatch(),
)

data class TopologyHostObservationEvent(
  val observationId: String,
  val timestamp: Long,
  val level: String,
  val category: String,
  val event: String,
  val message: String? = null,
  val sessionId: String? = null,
  val nodeId: String? = null,
  val connectionId: String? = null,
  val data: JSONObject? = null,
)

data class TopologyHostDiagnosticsSnapshot(
  val hostRuntime: TopologyHostRuntimeInfo,
  val tickets: List<TopologyHostTicketRecord>,
  val sessions: List<TopologyHostSessionRecord>,
  val relayCounters: TopologyHostRelayCounters,
  val activeFaultRules: List<TopologyHostFaultRule>,
  val recentEvents: List<TopologyHostObservationEvent>,
)

internal data class TopologyHostConnectionContext(
  val connectionId: String,
  var sessionId: String? = null,
  var nodeId: String? = null,
)
