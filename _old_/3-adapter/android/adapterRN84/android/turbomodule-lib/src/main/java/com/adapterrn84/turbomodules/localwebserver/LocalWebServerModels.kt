package com.adapterrn84.turbomodules.localwebserver

data class RuntimeConfig(
    val heartbeatTimeout: Long = 60_000L,
    val retryCacheTimeout: Long = 30_000L,
)

data class ServerConfig(
    val port: Int = 8888,
    val basePath: String = "/localServer",
    val heartbeatInterval: Long = 30_000L,
    val defaultRuntimeConfig: RuntimeConfig = RuntimeConfig(),
)

enum class DeviceType { MASTER, SLAVE }

data class DeviceInfo(
    val type: DeviceType,
    val deviceId: String,
    val masterDeviceId: String,
    val token: String,
    val runtimeConfig: RuntimeConfig? = null,
    val connectedAt: Long = System.currentTimeMillis(),
)

data class ServerStats(
    val masterCount: Int,
    val slaveCount: Int,
    val pendingCount: Int,
    val uptime: Long,
)
