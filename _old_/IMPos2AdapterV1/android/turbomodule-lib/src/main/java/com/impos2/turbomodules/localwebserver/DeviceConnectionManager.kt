package com.impos2.turbomodules.localwebserver

import android.util.Log
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * 设备连接管理器
 *
 * 负责管理 Master-Slave 设备的注册、连接、消息路由和心跳检测
 *
 * 优化点:
 * 1. 使用 ConcurrentHashMap 确保线程安全
 * 2. 自动清理过期的待注册设备
 * 3. 心跳检测机制,自动断开超时设备
 * 4. Master-Slave 关联管理,Master 断开时自动断开所有 Slave
 */
class DeviceConnectionManager(
    private val config: ServerConfig
) {
    companion object {
        private const val TAG = "DeviceConnectionManager"
        private const val TOKEN_EXPIRE_TIME = 5 * 60 * 1000L // 5分钟
    }

    // 待注册设备 (token -> PendingDevice)
    private val pendingDevices = ConcurrentHashMap<String, PendingDevice>()

    // Master 设备 (deviceName -> DeviceConnection)
    private val masterDevices = ConcurrentHashMap<String, DeviceConnection>()

    // Slave 设备 (deviceName -> DeviceConnection)
    private val slaveDevices = ConcurrentHashMap<String, DeviceConnection>()

    // Master ID 到名称的映射
    private val masterIdToName = ConcurrentHashMap<String, String>()

    // Master 到 Slaves 的映射
    private val masterToSlaves = ConcurrentHashMap<String, MutableSet<String>>()

    // 服务器启动时间
    private val serverStartTime = System.currentTimeMillis()

    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * 待注册设备信息
     */
    data class PendingDevice(
        val info: DeviceInfo,
        val registrationTime: Long,
        val masterDeviceId: String? = null
    )

    /**
     * 设备连接信息
     */
    data class DeviceConnection(
        val session: WebSocketSession,
        val info: DeviceInfo,
        var lastHeartbeat: Long
    )

    init {
        // 启动定期清理任务
        startCleanupTask()
        // 启动心跳检测任务
        startHeartbeatTask()
    }

    /**
     * 预注册设备，返回 token
     */
    fun preRegisterDevice(registration: DeviceRegistration): RegistrationResponse {
        try {
            // 验证设备名称唯一性
            if (masterDevices.containsKey(registration.deviceName) ||
                slaveDevices.containsKey(registration.deviceName)) {
                return RegistrationResponse(
                    success = false,
                    error = "设备名称已存在: ${registration.deviceName}"
                )
            }

            // 如果是 Slave，验证 Master 是否存在
            if (registration.type == "slave") {
                val masterDeviceId = registration.masterDeviceId
                if (masterDeviceId == null) {
                    return RegistrationResponse(
                        success = false,
                        error = "Slave 设备必须指定 masterDeviceId"
                    )
                }
                if (!masterIdToName.containsKey(masterDeviceId)) {
                    return RegistrationResponse(
                        success = false,
                        error = "Master 设备不存在: $masterDeviceId"
                    )
                }
            }

            // 生成 token
            val token = UUID.randomUUID().toString()
            val deviceInfo = DeviceInfo(
                deviceType = registration.type,
                deviceId = registration.deviceId,
                deviceName = registration.deviceName
            )

            // 保存待注册设备
            pendingDevices[token] = PendingDevice(
                info = deviceInfo,
                registrationTime = System.currentTimeMillis(),
                masterDeviceId = registration.masterDeviceId
            )

            Log.d(TAG, "设备预注册成功: ${registration.deviceName}, token: $token")

            return RegistrationResponse(
                success = true,
                token = token,
                deviceInfo = deviceInfo
            )
        } catch (e: Exception) {
            Log.e(TAG, "预注册设备失败", e)
            return RegistrationResponse(
                success = false,
                error = "预注册失败: ${e.message}"
            )
        }
    }

    /**
     * 通过 token 连接设备
     */
    suspend fun connectDeviceWithToken(token: String, session: WebSocketSession): Boolean {
        val pending = pendingDevices.remove(token) ?: return false

        val connection = DeviceConnection(
            session = session,
            info = pending.info,
            lastHeartbeat = System.currentTimeMillis()
        )

        when (pending.info.deviceType) {
            "master" -> {
                masterDevices[pending.info.deviceName] = connection
                masterIdToName[pending.info.deviceId] = pending.info.deviceName
                // 使用 ConcurrentHashMap.newKeySet() 创建线程安全的 Set
                masterToSlaves[pending.info.deviceName] = ConcurrentHashMap.newKeySet()
                Log.d(TAG, "Master 设备连接成功: ${pending.info.deviceName}")
            }
            "slave" -> {
                slaveDevices[pending.info.deviceName] = connection
                val masterName = masterIdToName[pending.masterDeviceId]
                if (masterName != null) {
                    masterToSlaves[masterName]?.add(pending.info.deviceName)
                    // 通知 Master 有 Slave 连接
                    notifyMasterSlaveConnected(masterName, pending.info)
                }
                Log.d(TAG, "Slave 设备连接成功: ${pending.info.deviceName}")
            }
        }

        return true
    }

    /**
     * 通知 Master 有 Slave 连接
     */
    private suspend fun notifyMasterSlaveConnected(masterName: String, slaveInfo: DeviceInfo) {
        val master = masterDevices[masterName] ?: return

        val notification = buildJsonObject {
            put("from", "system")
            put("id", UUID.randomUUID().toString())
            put("type", SystemMessageTypes.SLAVE_CONNECTED)
            put("data", buildJsonObject {
                put("deviceId", slaveInfo.deviceId)
                put("deviceName", slaveInfo.deviceName)
            })
        }

        try {
            master.session.send(Frame.Text(notification.toString()))
            Log.d(TAG, "已通知 Master: Slave 连接 - ${slaveInfo.deviceName}")
        } catch (e: Exception) {
            Log.e(TAG, "通知 Master 失败", e)
        }
    }

    /**
     * 路由消息
     */
    suspend fun routeMessage(message: MessageWrapper, fromDevice: String) {
        // 判断发送者类型
        val isMaster = masterDevices.containsKey(fromDevice)

        if (isMaster) {
            // Master 发送消息
            routeMessageFromMaster(message, fromDevice)
        } else {
            // Slave 发送消息
            routeMessageFromSlave(message, fromDevice)
        }
    }

    /**
     * 路由来自 Master 的消息
     */
    private suspend fun routeMessageFromMaster(message: MessageWrapper, masterName: String) {
        val targetDevice = message.targetDevice

        if (targetDevice != null) {
            // 发送给指定 Slave
            val slave = slaveDevices[targetDevice]
            if (slave != null) {
                try {
                    slave.session.send(Frame.Text(Json.encodeToString(message)))
                    Log.d(TAG, "消息已发送: Master -> $targetDevice")
                } catch (e: Exception) {
                    Log.e(TAG, "发送消息失败", e)
                }
            }
        } else {
            // 广播给所有关联的 Slave
            val slaves = masterToSlaves[masterName] ?: emptySet()
            slaves.forEach { slaveName ->
                val slave = slaveDevices[slaveName]
                if (slave != null) {
                    try {
                        slave.session.send(Frame.Text(Json.encodeToString(message)))
                    } catch (e: Exception) {
                        Log.e(TAG, "广播消息失败: $slaveName", e)
                    }
                }
            }
            Log.d(TAG, "消息已广播: Master -> ${slaves.size} Slaves")
        }
    }

    /**
     * 路由来自 Slave 的消息
     */
    private suspend fun routeMessageFromSlave(message: MessageWrapper, slaveName: String) {
        // 查找 Slave 关联的 Master
        val masterName = masterToSlaves.entries.find { it.value.contains(slaveName) }?.key
        if (masterName != null) {
            val master = masterDevices[masterName]
            if (master != null) {
                try {
                    master.session.send(Frame.Text(Json.encodeToString(message)))
                    Log.d(TAG, "消息已发送: Slave($slaveName) -> Master($masterName)")
                } catch (e: Exception) {
                    Log.e(TAG, "发送消息失败", e)
                }
            }
        }
    }

    /**
     * 更新设备心跳时间
     */
    fun updateHeartbeat(deviceName: String) {
        masterDevices[deviceName]?.lastHeartbeat = System.currentTimeMillis()
        slaveDevices[deviceName]?.lastHeartbeat = System.currentTimeMillis()
    }

    /**
     * 通过 session 获取设备名称
     */
    fun getDeviceNameBySession(session: WebSocketSession): String? {
        masterDevices.entries.find { it.value.session == session }?.let {
            return it.key
        }
        slaveDevices.entries.find { it.value.session == session }?.let {
            return it.key
        }
        return null
    }

    /**
     * 断开设备
     */
    suspend fun disconnectDevice(deviceName: String) {
        val master = masterDevices.remove(deviceName)
        if (master != null) {
            // 断开 Master，同时断开所有关联的 Slave
            val slaves = masterToSlaves.remove(deviceName) ?: emptySet()
            slaves.forEach { slaveName ->
                slaveDevices.remove(slaveName)
            }
            masterIdToName.entries.removeIf { it.value == deviceName }
            Log.d(TAG, "Master 设备已断开: $deviceName, 关联 Slave: ${slaves.size}")
            return
        }

        val slave = slaveDevices.remove(deviceName)
        if (slave != null) {
            // 断开 Slave，通知 Master
            val masterName = masterToSlaves.entries.find { it.value.contains(deviceName) }?.key
            if (masterName != null) {
                masterToSlaves[masterName]?.remove(deviceName)
                notifyMasterSlaveDisconnected(masterName, slave.info)
            }
            Log.d(TAG, "Slave 设备已断开: $deviceName")
        }
    }

    /**
     * 通知 Master 有 Slave 断开
     */
    private suspend fun notifyMasterSlaveDisconnected(masterName: String, slaveInfo: DeviceInfo) {
        val master = masterDevices[masterName] ?: return

        val notification = buildJsonObject {
            put("from", "system")
            put("id", UUID.randomUUID().toString())
            put("type", SystemMessageTypes.SLAVE_DISCONNECTED)
            put("data", buildJsonObject {
                put("deviceId", slaveInfo.deviceId)
                put("deviceName", slaveInfo.deviceName)
            })
        }

        try {
            master.session.send(Frame.Text(notification.toString()))
            Log.d(TAG, "已通知 Master: Slave 断开 - ${slaveInfo.deviceName}")
        } catch (e: Exception) {
            Log.e(TAG, "通知 Master 失败", e)
        }
    }

    /**
     * 启动定期清理任务
     */
    private fun startCleanupTask() {
        scope.launch {
            while (isActive) {
                delay(60000) // 每分钟清理一次
                cleanExpiredPendingDevices()
            }
        }
    }

    /**
     * 清理过期的待注册设备
     */
    private fun cleanExpiredPendingDevices() {
        val now = System.currentTimeMillis()
        val expired = pendingDevices.filter { (_, pending) ->
            now - pending.registrationTime > TOKEN_EXPIRE_TIME
        }
        expired.keys.forEach { token ->
            pendingDevices.remove(token)
        }
        if (expired.isNotEmpty()) {
            Log.d(TAG, "清理过期待注册设备: ${expired.size} 个")
        }
    }

    /**
     * 启动心跳检测任务
     */
    private fun startHeartbeatTask() {
        scope.launch {
            while (isActive) {
                delay(config.heartbeatInterval)
                sendHeartbeat()
                checkTimeoutDevices()
            }
        }
    }

    /**
     * 发送心跳消息
     */
    private suspend fun sendHeartbeat() {
        val heartbeat = buildJsonObject {
            put("from", "system")
            put("id", UUID.randomUUID().toString())
            put("type", SystemMessageTypes.HEARTBEAT)
            put("data", buildJsonObject {})
        }

        val allDevices = masterDevices.values + slaveDevices.values
        allDevices.forEach { device ->
            try {
                device.session.send(Frame.Text(heartbeat.toString()))
            } catch (e: Exception) {
                Log.e(TAG, "发送心跳失败", e)
            }
        }
    }

    /**
     * 检查超时设备
     */
    private suspend fun checkTimeoutDevices() {
        val now = System.currentTimeMillis()
        val timeout = config.heartbeatTimeout

        val timeoutMasters = masterDevices.filter { (_, device) ->
            now - device.lastHeartbeat > timeout
        }

        val timeoutSlaves = slaveDevices.filter { (_, device) ->
            now - device.lastHeartbeat > timeout
        }

        timeoutMasters.keys.forEach { deviceName ->
            Log.w(TAG, "Master 设备超时: $deviceName")
            disconnectDevice(deviceName)
        }

        timeoutSlaves.keys.forEach { deviceName ->
            Log.w(TAG, "Slave 设备超时: $deviceName")
            disconnectDevice(deviceName)
        }
    }

    /**
     * 获取统计信息
     */
    fun getStats(): ServerStats {
        return ServerStats(
            masterCount = masterDevices.size,
            slaveCount = slaveDevices.size,
            pendingCount = pendingDevices.size,
            uptime = System.currentTimeMillis() - serverStartTime
        )
    }

    /**
     * 关闭管理器
     */
    fun close() {
        try {
            // 使用 runBlocking 来调用 suspend 函数
            runBlocking {
                // 断开所有 Master 设备
                masterDevices.keys.toList().forEach { deviceName ->
                    try {
                        disconnectDevice(deviceName)
                    } catch (e: Exception) {
                        Log.e(TAG, "断开 Master 设备失败: $deviceName", e)
                    }
                }

                // 断开所有 Slave 设备
                slaveDevices.keys.toList().forEach { deviceName ->
                    try {
                        disconnectDevice(deviceName)
                    } catch (e: Exception) {
                        Log.e(TAG, "断开 Slave 设备失败: $deviceName", e)
                    }
                }
            }

            // 清理所有数据
            pendingDevices.clear()
            masterDevices.clear()
            slaveDevices.clear()
            masterIdToName.clear()
            masterToSlaves.clear()

            // 取消协程作用域
            scope.cancel()

            Log.d(TAG, "DeviceConnectionManager 已关闭")
        } catch (e: Exception) {
            Log.e(TAG, "关闭 DeviceConnectionManager 失败", e)
        }
    }
}
