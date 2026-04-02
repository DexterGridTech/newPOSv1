package com.impos2.adapter.interfaces

/**
 * LocalWebServer 启动配置。
 */
data class LocalWebServerConfig(
  val port: Int = 8888,
  val basePath: String = "/localServer",
  val heartbeatInterval: Long = 30_000L,
  val heartbeatTimeout: Long = 60_000L
)

/**
 * LocalWebServer 生命周期状态。
 */
enum class LocalWebServerStatus {
  STOPPED,
  STARTING,
  RUNNING,
  STOPPING,
  ERROR
}

/**
 * 一个对外可访问地址。
 */
data class ServerAddress(
  val name: String,
  val address: String
)

/**
 * LocalWebServer 当前状态信息。
 */
data class LocalWebServerInfo(
  val status: LocalWebServerStatus,
  val addresses: List<ServerAddress>,
  val config: LocalWebServerConfig,
  val error: String? = null
)

/**
 * LocalWebServer 运行统计。
 */
data class ServerStats(
  val masterCount: Int = 0,
  val slaveCount: Int = 0,
  val pendingCount: Int = 0,
  val uptime: Long = 0L,
  val requestCount: Long = 0L
)
