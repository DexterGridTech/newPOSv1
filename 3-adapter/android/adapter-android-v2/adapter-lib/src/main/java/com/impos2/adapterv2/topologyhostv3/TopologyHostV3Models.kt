package com.impos2.adapterv2.topologyhostv3

const val TOPOLOGY_HOST_V3_MODULE_NAME = "adapter.android.topology-host-v3"

object TopologyHostV3Defaults {
  const val DEFAULT_PORT = 8888
  const val DEFAULT_BASE_PATH = "/mockMasterServer"
  const val DEFAULT_PROTOCOL_VERSION = "2026.04-v3"
  const val DEFAULT_RUNTIME_VERSION = "android-topology-host-v3"
  const val DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000L
  const val DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000L
}

enum class TopologyHostV3ServiceState {
  STOPPED,
  STARTING,
  RUNNING,
  STOPPING,
  ERROR,
}

data class TopologyHostV3Config(
  val port: Int = TopologyHostV3Defaults.DEFAULT_PORT,
  val basePath: String = TopologyHostV3Defaults.DEFAULT_BASE_PATH,
  val heartbeatIntervalMs: Long = TopologyHostV3Defaults.DEFAULT_HEARTBEAT_INTERVAL_MS,
  val heartbeatTimeoutMs: Long = TopologyHostV3Defaults.DEFAULT_HEARTBEAT_TIMEOUT_MS,
)

data class TopologyHostV3AddressInfo(
  val host: String,
  val port: Int,
  val basePath: String,
  val httpBaseUrl: String,
  val wsUrl: String,
  val bindHost: String,
  val localHttpBaseUrl: String,
  val localWsUrl: String,
)

data class TopologyHostV3Stats(
  val sessionCount: Int = 0,
  val peerCount: Int = 0,
  val stalePeerCount: Int = 0,
  val activeFaultRuleCount: Int = 0,
)

data class TopologyHostV3StatusInfo(
  val state: TopologyHostV3ServiceState,
  val addressInfo: TopologyHostV3AddressInfo?,
  val config: TopologyHostV3Config,
  val error: String? = null,
)

data class TopologyHostV3RuntimeInfo(
  val nodeId: String,
  val deviceId: String,
  val instanceMode: String,
  val displayMode: String,
  val standalone: Boolean,
  val protocolVersion: String,
  val capabilities: List<String>,
)

data class TopologyHostV3Hello(
  val helloId: String,
  val runtime: TopologyHostV3RuntimeInfo,
  val sentAt: Long,
)

data class TopologyHostV3HelloAck(
  val helloId: String,
  val accepted: Boolean,
  val sessionId: String? = null,
  val peerRuntime: TopologyHostV3RuntimeInfo? = null,
  val rejectionCode: String? = null,
  val rejectionMessage: String? = null,
  val hostTime: Long,
)

data class TopologyHostV3FaultRule(
  val ruleId: String,
  val kind: String,
  val channel: String? = null,
  val delayMs: Long? = null,
)

data class TopologyHostV3DiagnosticsSnapshot(
  val moduleName: String,
  val state: String,
  val sessionId: String? = null,
  val hostRuntime: TopologyHostV3RuntimeInfo? = null,
  val peers: List<TopologyHostV3PeerSnapshot> = emptyList(),
  val faultRules: List<TopologyHostV3FaultRule> = emptyList(),
)

data class TopologyHostV3PeerSnapshot(
  val role: String,
  val nodeId: String,
  val deviceId: String,
  val lastSeenAt: Long,
  val lastHeartbeatSentAt: Long? = null,
  val stale: Boolean = false,
)

internal data class TopologyHostV3PeerRecord(
  val runtime: TopologyHostV3RuntimeInfo,
  val connectionId: String,
  val connectedAt: Long,
  var lastSeenAt: Long,
  var lastHeartbeatSentAt: Long? = null,
)
