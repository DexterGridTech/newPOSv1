package com.impos2.turbomodules.localwebserver

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * 系统消息类型常量（与客户端完全一致）
 */
object SystemMessageTypes {
    const val SLAVE_CONNECTED = "__system_slave_connected"
    const val SLAVE_DISCONNECTED = "__system_slave_disconnected"
    const val HEARTBEAT = "__system_heartbeat"
    const val HEARTBEAT_ACK = "__system_heartbeat_ack"
}

/**
 * 服务器配置
 */
@Serializable
data class ServerConfig(
    val port: Int = 8888,
    val basePath: String = "/localServer",
    val heartbeatInterval: Long = 30000,
    val heartbeatTimeout: Long = 60000
)

/**
 * 设备注册信息
 */
@Serializable
data class DeviceRegistration(
    val type: String,  // "master" | "slave"
    val deviceId: String,
    val deviceName: String,
    val masterDeviceId: String? = null
)

/**
 * 设备信息
 */
@Serializable
data class DeviceInfo(
    val deviceType: String,
    val deviceId: String,
    val deviceName: String
)

/**
 * 注册响应
 */
@Serializable
data class RegistrationResponse(
    val success: Boolean,
    val token: String? = null,
    val deviceInfo: DeviceInfo? = null,
    val error: String? = null
)

/**
 * 消息封装
 */
@Serializable
data class MessageWrapper(
    val from: String,
    val id: String,
    val type: String,
    val data: JsonElement,
    val targetDevice: String? = null
)

/**
 * 服务器统计信息
 */
@Serializable
data class ServerStats(
    val masterCount: Int,
    val slaveCount: Int,
    val pendingCount: Int,
    val uptime: Long
)

/**
 * 服务器地址
 */
@Serializable
data class ServerAddress(
    val name: String,
    val address: String
)

/**
 * 服务器状态信息（用于序列化返回）
 */
@Serializable
data class ServerStatusInfo(
    val status: String,
    val addresses: List<ServerAddress> = emptyList(),
    val config: ServerConfig? = null,
    val error: String? = null
)
