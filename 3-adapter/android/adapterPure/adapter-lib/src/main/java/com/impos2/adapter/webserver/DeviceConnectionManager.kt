package com.impos2.adapter.webserver

import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

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

data class DeviceConnectionStats(
    val masterCount: Int,
    val slaveCount: Int,
    val pendingCount: Int,
    val uptime: Long,
)

/**
 * 设备连接关系管理器。
 *
 * 这个类只关注“设备之间如何建立、维持、清理连接关系”，不关心 WebSocket/HTTP 细节。
 * LocalWebServer 收到的注册、心跳、配对、断开事件最终都会落到这里，统一形成：
 * - pending 设备；
 * - 已配对 master/slave 关系；
 * - socket 与设备 id 的映射；
 * - 可观测的连接统计。
 *
 * 设计重点：
 * - 写路径尽量短，避免在锁里做 I/O；
 * - 读路径保持快照一致性，便于诊断与状态查询；
 * - 对异常顺序的事件具备容错能力，避免脏映射越积越多。
 */
class DeviceConnectionManager(private val config: ServerConfig) {

    companion object {
        private const val TAG = "DeviceConnectionManager"
        private const val TOKEN_EXPIRE_MS = 5 * 60 * 1000L
    }

    // 保护多张映射表的读写一致性。锁内只做轻量状态变更，不做网络 I/O。
    private val lock = ReentrantReadWriteLock()
    private val pending = ConcurrentHashMap<String, DeviceInfo>()
    private val pairs = ConcurrentHashMap<String, DevicePair>()
    private val socketToDevice = ConcurrentHashMap<String, String>()
    private val slaveToMaster = ConcurrentHashMap<String, String>()
    private val startTime = System.currentTimeMillis()
    private val connectCount = AtomicLong(0L)
    private val disconnectCount = AtomicLong(0L)
    private val heartbeatUpdateCount = AtomicLong(0L)
    private val pendingCleanupCount = AtomicLong(0L)
    private val rejectedPreRegisterCount = AtomicLong(0L)
    private val rejectedConnectCount = AtomicLong(0L)

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

    fun preRegister(info: DeviceInfo): String? = lock.write {
        val validationError = validatePreRegisterLocked(info)
        if (validationError != null) {
            rejectedPreRegisterCount.incrementAndGet()
            Log.w(TAG, "preRegister rejected: type=${info.type}, deviceId=${info.deviceId}, reason=$validationError")
            return validationError
        }

        removeDuplicatePendingLocked(info)
        pending[info.token] = info
        null
    }

    fun connect(socket: WsSession, token: String): Pair<DeviceInfo?, String?> = lock.write {
        val info = pending.remove(token) ?: run {
            rejectedConnectCount.incrementAndGet()
            return null to "Invalid or expired token"
        }
        val connected = ConnectedDevice(socket, info)

        if (info.type == DeviceType.MASTER) {
            val existing = pairs[info.deviceId]
            if (existing?.master != null) {
                rejectedConnectCount.incrementAndGet()
                return null to "Master already connected"
            }
            val runtimeConfig = info.runtimeConfig ?: config.defaultRuntimeConfig
            val pair = existing ?: DevicePair(runtimeConfig = runtimeConfig)
            pair.master = connected
            pairs[info.deviceId] = pair
        } else {
            val pair = pairs[info.masterDeviceId] ?: run {
                rejectedConnectCount.incrementAndGet()
                return null to "Master disconnected"
            }
            if (pair.master == null) {
                rejectedConnectCount.incrementAndGet()
                return null to "Master disconnected"
            }
            if (pair.slave != null) {
                rejectedConnectCount.incrementAndGet()
                return null to "Master already has a slave"
            }
            pair.slave = connected
            slaveToMaster[info.deviceId] = info.masterDeviceId
        }

        socketToDevice[socket.key] = info.deviceId
        connectCount.incrementAndGet()
        Log.i(TAG, "connect: type=${info.type}, deviceId=${info.deviceId}, master=${info.masterDeviceId}")
        info to null
    }

    fun getRuntimeConfig(masterDeviceId: String): RuntimeConfig = lock.read {
        pairs[masterDeviceId]?.runtimeConfig ?: config.defaultRuntimeConfig
    }

    fun findBySocket(socketKey: String): Triple<DeviceType, String, String>? = lock.read {
        val deviceId = socketToDevice[socketKey] ?: return null
        val pair = pairs[deviceId]
        if (pair?.master?.socket?.key == socketKey) {
            return Triple(DeviceType.MASTER, deviceId, deviceId)
        }
        val masterId = slaveToMaster[deviceId] ?: return null
        Triple(DeviceType.SLAVE, deviceId, masterId)
    }

    fun getPeer(masterDeviceId: String, selfType: DeviceType): ConnectedDevice? = lock.read {
        val pair = pairs[masterDeviceId] ?: return null
        if (selfType == DeviceType.MASTER) pair.slave else pair.master
    }

    fun getMaster(masterDeviceId: String): ConnectedDevice? = lock.read {
        pairs[masterDeviceId]?.master
    }

    fun getSlave(masterDeviceId: String): ConnectedDevice? = lock.read {
        pairs[masterDeviceId]?.slave
    }

    fun updateHeartbeat(socketKey: String) {
        lock.read {
            val deviceId = socketToDevice[socketKey] ?: return
            val masterPair = pairs[deviceId]
            if (masterPair?.master?.socket?.key == socketKey) {
                masterPair.master?.lastHeartbeat = System.currentTimeMillis()
                heartbeatUpdateCount.incrementAndGet()
                return
            }
            val masterId = slaveToMaster[deviceId] ?: return
            val pair = pairs[masterId] ?: return
            pair.slave?.takeIf { it.socket.key == socketKey }?.let {
                it.lastHeartbeat = System.currentTimeMillis()
                heartbeatUpdateCount.incrementAndGet()
            }
        }
    }

    fun disconnectMaster(masterDeviceId: String) {
        val sessionsToClose = lock.write {
            val pair = pairs.remove(masterDeviceId) ?: return
            val sessions = mutableListOf<WsSession>()
            pair.slave?.let {
                removeSocketAssociationsLocked(it)
                sessions += it.socket
            }
            pair.master?.let {
                removeSocketAssociationsLocked(it)
                sessions += it.socket
            }
            disconnectCount.incrementAndGet()
            Log.i(TAG, "disconnectMaster: master=$masterDeviceId")
            sessions
        }
        closeSessions(sessionsToClose)
    }

    fun disconnectSlave(masterDeviceId: String) {
        val sessionToClose = lock.write {
            val pair = pairs[masterDeviceId] ?: return
            val slave = pair.slave ?: return
            removeSocketAssociationsLocked(slave)
            pair.slave = null
            disconnectCount.incrementAndGet()
            Log.i(TAG, "disconnectSlave: master=$masterDeviceId, slave=${slave.info.deviceId}")
            slave.socket
        }
        closeSession(sessionToClose)
    }

    fun checkHeartbeatTimeouts(): List<Triple<DeviceType, String, String>> = lock.read {
        val now = System.currentTimeMillis()
        val result = mutableListOf<Triple<DeviceType, String, String>>()
        for ((masterId, pair) in pairs) {
            val timeout = pair.runtimeConfig.heartbeatTimeout
            pair.master?.let {
                if (now - it.lastHeartbeat > timeout) {
                    result.add(Triple(DeviceType.MASTER, it.info.deviceId, masterId))
                }
            }
            pair.slave?.let {
                if (now - it.lastHeartbeat > timeout) {
                    result.add(Triple(DeviceType.SLAVE, it.info.deviceId, masterId))
                }
            }
        }
        result
    }

    fun cleanExpiredPending() {
        val now = System.currentTimeMillis()
        val removed = lock.write {
            val expiredTokens = pending.entries
                .filter { now - it.value.connectedAt > TOKEN_EXPIRE_MS }
                .map { it.key }
            expiredTokens.forEach { pending.remove(it) }
            expiredTokens.size
        }
        if (removed > 0) {
            pendingCleanupCount.addAndGet(removed.toLong())
            Log.i(TAG, "cleanExpiredPending: removed=$removed")
        }
    }

    fun getAllSessions(): List<Pair<WsSession, String>> = lock.read {
        val result = mutableListOf<Pair<WsSession, String>>()
        for ((masterId, pair) in pairs) {
            pair.master?.let { result.add(it.socket to masterId) }
            pair.slave?.let { result.add(it.socket to masterId) }
        }
        result
    }

    fun getStats(): DeviceConnectionStats = lock.read {
        DeviceConnectionStats(
            masterCount = pairs.values.count { it.master != null },
            slaveCount = pairs.values.count { it.slave != null },
            pendingCount = pending.size,
            uptime = System.currentTimeMillis() - startTime,
        )
    }

    fun dumpState(): String = lock.read {
        buildString {
            append("masters=")
            append(pairs.values.count { it.master != null })
            append(", slaves=")
            append(pairs.values.count { it.slave != null })
            append(", pending=")
            append(pending.size)
            append(", sockets=")
            append(socketToDevice.size)
            append(", slaveMap=")
            append(slaveToMaster.size)
            append(", connects=")
            append(connectCount.get())
            append(", disconnects=")
            append(disconnectCount.get())
            append(", heartbeatUpdates=")
            append(heartbeatUpdateCount.get())
            append(", pendingCleanups=")
            append(pendingCleanupCount.get())
            append(", rejectedPreRegisters=")
            append(rejectedPreRegisterCount.get())
            append(", rejectedConnects=")
            append(rejectedConnectCount.get())
        }
    }

    fun close() {
        val sessions = lock.write {
            val result = mutableListOf<WsSession>()
            pairs.values.forEach { pair ->
                pair.master?.let {
                    removeSocketAssociationsLocked(it)
                    result += it.socket
                }
                pair.slave?.let {
                    removeSocketAssociationsLocked(it)
                    result += it.socket
                }
            }
            pairs.clear()
            pending.clear()
            socketToDevice.clear()
            slaveToMaster.clear()
            result
        }
        closeSessions(sessions)
    }

    private fun validatePreRegisterLocked(info: DeviceInfo): String? {
        return if (info.type == DeviceType.MASTER) {
            if (pairs[info.deviceId]?.master != null) {
                "Master already connected"
            } else {
                null
            }
        } else {
            val pair = pairs[info.masterDeviceId] ?: return "Master not connected"
            if (pair.master == null) {
                "Master not connected"
            } else if (pair.slave != null) {
                "Master already has a slave"
            } else {
                null
            }
        }
    }

    private fun removeDuplicatePendingLocked(info: DeviceInfo) {
        pending.entries.removeIf { entry ->
            val value = entry.value
            value.type == info.type &&
                value.deviceId == info.deviceId &&
                value.masterDeviceId == info.masterDeviceId &&
                entry.key != info.token
        }
    }

    private fun removeSocketAssociationsLocked(connected: ConnectedDevice) {
        socketToDevice.remove(connected.socket.key)
        if (connected.info.type == DeviceType.SLAVE) {
            slaveToMaster.remove(connected.info.deviceId)
        }
    }

    private fun closeSessions(sessions: List<WsSession>) {
        sessions.forEach { closeSession(it) }
    }

    private fun closeSession(session: WsSession?) {
        try {
            session?.close()
        } catch (e: Exception) {
            Log.w(TAG, "closeSession failed", e)
        }
    }
}
