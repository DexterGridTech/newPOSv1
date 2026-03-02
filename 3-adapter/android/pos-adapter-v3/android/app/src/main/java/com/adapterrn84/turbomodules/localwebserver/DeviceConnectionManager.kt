package com.adapterrn84.turbomodules.localwebserver

import java.util.concurrent.ConcurrentHashMap

// ─── 数据类型 ─────────────────────────────────────────────────────────────────

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

// ─── DeviceConnectionManager ──────────────────────────────────────────────────

class DeviceConnectionManager(private val config: ServerConfig) {

    private val TOKEN_EXPIRE_MS = 5 * 60 * 1000L

    private val pending = ConcurrentHashMap<String, DeviceInfo>()
    private val pairs = ConcurrentHashMap<String, DevicePair>()
    private val socketToDevice = ConcurrentHashMap<String, String>()
    private val slaveToMaster = ConcurrentHashMap<String, String>()
    private val startTime = System.currentTimeMillis()

    data class ConnectedDevice(
        val socket: WsSession,
        val info: DeviceInfo,
        @Volatile var lastHeartbeat: Long = System.currentTimeMillis(),
    )

    data class DevicePair(
        @Volatile var master: ConnectedDevice? = null,
        @Volatile var slave: ConnectedDevice? = null,
        val runtimeConfig: RuntimeConfig,
    )

    @Synchronized
    fun preRegister(info: DeviceInfo): String? {
        if (info.type == DeviceType.MASTER) {
            if (pairs[info.deviceId]?.master != null) return "Master already connected"
        } else {
            val pair = pairs[info.masterDeviceId] ?: return "Master not connected"
            if (pair.master == null) return "Master not connected"
            if (pair.slave != null) return "Master already has a slave"
        }
        pending[info.token] = info
        return null
    }

    @Synchronized
    fun connect(socket: WsSession, token: String): Pair<DeviceInfo?, String?> {
        val info = pending.remove(token) ?: return null to "Invalid or expired token"
        val connected = ConnectedDevice(socket, info)

        if (info.type == DeviceType.MASTER) {
            val existing = pairs[info.deviceId]
            if (existing?.master != null) return null to "Master already connected"
            val rc = info.runtimeConfig ?: config.defaultRuntimeConfig
            val pair = existing ?: DevicePair(runtimeConfig = rc)
            pair.master = connected
            pairs[info.deviceId] = pair
        } else {
            val pair = pairs[info.masterDeviceId] ?: return null to "Master disconnected"
            if (pair.master == null) return null to "Master disconnected"
            if (pair.slave != null) return null to "Master already has a slave"
            pair.slave = connected
            slaveToMaster[info.deviceId] = info.masterDeviceId
        }
        socketToDevice[socket.key] = info.deviceId
        return info to null
    }

    fun getRuntimeConfig(masterDeviceId: String): RuntimeConfig =
        pairs[masterDeviceId]?.runtimeConfig ?: config.defaultRuntimeConfig

    fun findBySocket(socketKey: String): Triple<DeviceType, String, String>? {
        val deviceId = socketToDevice[socketKey] ?: return null
        val pair = pairs[deviceId]
        if (pair?.master?.socket?.key == socketKey)
            return Triple(DeviceType.MASTER, deviceId, deviceId)
        val masterId = slaveToMaster[deviceId] ?: return null
        return Triple(DeviceType.SLAVE, deviceId, masterId)
    }

    fun getPeer(masterDeviceId: String, selfType: DeviceType): ConnectedDevice? {
        val pair = pairs[masterDeviceId] ?: return null
        return if (selfType == DeviceType.MASTER) pair.slave else pair.master
    }

    fun getMaster(masterDeviceId: String) = pairs[masterDeviceId]?.master
    fun getSlave(masterDeviceId: String) = pairs[masterDeviceId]?.slave

    fun updateHeartbeat(socketKey: String) {
        val (type, _, masterId) = findBySocket(socketKey) ?: return
        val pair = pairs[masterId] ?: return
        val target = if (type == DeviceType.MASTER) pair.master else pair.slave
        target?.lastHeartbeat = System.currentTimeMillis()
    }

    @Synchronized
    fun disconnectMaster(masterDeviceId: String) {
        val pair = pairs.remove(masterDeviceId) ?: return
        pair.slave?.let {
            socketToDevice.remove(it.socket.key)
            slaveToMaster.remove(it.info.deviceId)
            it.socket.close()
        }
        pair.master?.let { socketToDevice.remove(it.socket.key) }
    }

    @Synchronized
    fun disconnectSlave(masterDeviceId: String) {
        val pair = pairs[masterDeviceId] ?: return
        pair.slave?.let {
            socketToDevice.remove(it.socket.key)
            slaveToMaster.remove(it.info.deviceId)
            it.socket.close()
            pair.slave = null
        }
    }

    fun checkHeartbeatTimeouts(): List<Triple<DeviceType, String, String>> {
        val now = System.currentTimeMillis()
        val result = mutableListOf<Triple<DeviceType, String, String>>()
        for ((masterId, pair) in pairs) {
            val timeout = pair.runtimeConfig.heartbeatTimeout
            pair.master?.let {
                if (now - it.lastHeartbeat > timeout)
                    result.add(Triple(DeviceType.MASTER, it.info.deviceId, masterId))
            }
            pair.slave?.let {
                if (now - it.lastHeartbeat > timeout)
                    result.add(Triple(DeviceType.SLAVE, it.info.deviceId, masterId))
            }
        }
        return result
    }

    fun cleanExpiredPending() {
        val now = System.currentTimeMillis()
        pending.entries.removeIf { now - it.value.connectedAt > TOKEN_EXPIRE_MS }
    }

    fun getAllSessions(): List<Pair<WsSession, String>> {
        val result = mutableListOf<Pair<WsSession, String>>()
        for ((masterId, pair) in pairs) {
            pair.master?.let { result.add(it.socket to masterId) }
            pair.slave?.let { result.add(it.socket to masterId) }
        }
        return result
    }

    fun getStats() = ServerStats(
        masterCount = pairs.values.count { it.master != null },
        slaveCount = pairs.values.count { it.slave != null },
        pendingCount = pending.size,
        uptime = System.currentTimeMillis() - startTime,
    )

    fun close() {
        pairs.values.forEach { p ->
            p.master?.socket?.close()
            p.slave?.socket?.close()
        }
        pairs.clear(); pending.clear(); socketToDevice.clear(); slaveToMaster.clear()
    }
}
