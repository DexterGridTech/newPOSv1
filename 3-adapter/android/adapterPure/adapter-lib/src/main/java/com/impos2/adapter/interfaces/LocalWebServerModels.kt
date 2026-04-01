package com.impos2.adapter.interfaces

data class LocalWebServerConfig(
  val port: Int = 8888,
  val basePath: String = "/localServer",
  val heartbeatInterval: Long = 30_000L,
  val heartbeatTimeout: Long = 60_000L
)

enum class LocalWebServerStatus {
  STOPPED,
  STARTING,
  RUNNING,
  STOPPING,
  ERROR
}

data class ServerAddress(
  val name: String,
  val address: String
)

data class LocalWebServerInfo(
  val status: LocalWebServerStatus,
  val addresses: List<ServerAddress>,
  val config: LocalWebServerConfig,
  val error: String? = null
)

data class ServerStats(
  val masterCount: Int = 0,
  val slaveCount: Int = 0,
  val pendingCount: Int = 0,
  val uptime: Long = 0L,
  val requestCount: Long = 0L
)
