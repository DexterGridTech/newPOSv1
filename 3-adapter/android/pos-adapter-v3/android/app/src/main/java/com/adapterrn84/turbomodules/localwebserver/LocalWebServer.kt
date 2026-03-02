package com.adapterrn84.turbomodules.localwebserver

import android.util.Log
import org.json.JSONObject
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

private const val TAG = "LocalWebServer"

// ─── WsSession ────────────────────────────────────────────────────────────────

class WsSession(private val socket: Socket) {
    val key: String = UUID.randomUUID().toString()
    private val out = socket.getOutputStream()
    @Volatile var isOpen = true

    fun send(text: String) {
        if (!isOpen) return
        try {
            val data = text.toByteArray(Charsets.UTF_8)
            val len = data.size
            val frame = ByteArrayOutputStream()
            frame.write(0x81) // FIN + text opcode
            when {
                len <= 125 -> frame.write(len)
                len <= 65535 -> { frame.write(126); frame.write(len shr 8); frame.write(len and 0xFF) }
                else -> {
                    frame.write(127)
                    for (i in 7 downTo 0) frame.write((len.toLong() shr (i * 8)).toInt() and 0xFF)
                }
            }
            frame.write(data)
            synchronized(out) { out.write(frame.toByteArray()); out.flush() }
        } catch (_: Exception) { isOpen = false }
    }

    fun sendPong(payload: ByteArray) {
        if (!isOpen) return
        try {
            val frame = ByteArrayOutputStream()
            frame.write(0x8A) // FIN + pong opcode
            frame.write(payload.size)
            frame.write(payload)
            synchronized(out) { out.write(frame.toByteArray()); out.flush() }
        } catch (_: Exception) { isOpen = false }
    }

    fun close() {
        isOpen = false
        try {
            val frame = byteArrayOf(0x88.toByte(), 0x00) // close frame
            synchronized(out) { out.write(frame); out.flush() }
        } catch (_: Exception) {}
        try { socket.close() } catch (_: Exception) {}
    }
}

// ─── WsFrameReader ────────────────────────────────────────────────────────────

class WsFrameReader(private val ins: InputStream, private val onPing: (ByteArray) -> Unit = {}) {
    fun readFrame(): String? {
        while (true) {
            return try {
                val b0 = ins.read(); if (b0 < 0) return null
                val b1 = ins.read(); if (b1 < 0) return null
                val opcode = b0 and 0x0F
                if (opcode == 0x8) return null // close
                val masked = (b1 and 0x80) != 0
                var payloadLen = (b1 and 0x7F).toLong()
                if (payloadLen == 126L) {
                    payloadLen = ((ins.read() shl 8) or ins.read()).toLong()
                } else if (payloadLen == 127L) {
                    payloadLen = 0; repeat(8) { payloadLen = (payloadLen shl 8) or ins.read().toLong() }
                }
                if (payloadLen > Int.MAX_VALUE) return null
                val mask = if (masked) ByteArray(4) { ins.read().toByte() } else null
                val data = ByteArray(payloadLen.toInt())
                var read = 0
                while (read < data.size) {
                    val n = ins.read(data, read, data.size - read)
                    if (n < 0) return null
                    read += n
                }
                if (mask != null) data.forEachIndexed { i, _ -> data[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte() }
                if (opcode == 0x9) { onPing(data); continue } // ping -> pong, read next frame
                String(data, Charsets.UTF_8)
            } catch (_: Exception) { null }
        }
    }
}

// ─── LocalWebServer ───────────────────────────────────────────────────────────

class LocalWebServer(
    private val config: ServerConfig,
    private val deviceManager: DeviceConnectionManager,
) {
    private val executor = java.util.concurrent.ThreadPoolExecutor(
        4, 16, 60L, java.util.concurrent.TimeUnit.SECONDS,
        java.util.concurrent.LinkedBlockingQueue(128)
    )
    private val dedicatedThreads = java.util.concurrent.CopyOnWriteArrayList<Thread>()
    private var serverSocket: ServerSocket? = null
    @Volatile var isRunning = false

    private fun dedicatedThread(block: () -> Unit): Thread =
        Thread(block).also { it.isDaemon = true; it.start(); dedicatedThreads.add(it) }

    fun start() {
        serverSocket = ServerSocket(config.port)
        isRunning = true
        dedicatedThread {
            while (isRunning) {
                try {
                    val client = serverSocket?.accept() ?: break
                    executor.submit { handleClient(client) }
                } catch (_: Exception) { break }
            }
        }
    }

    fun stop() {
        isRunning = false
        try { serverSocket?.close() } catch (_: Exception) {}
        dedicatedThreads.forEach { it.interrupt() }
        dedicatedThreads.clear()
        executor.shutdown()
        executor.awaitTermination(3, java.util.concurrent.TimeUnit.SECONDS)
        retryQueues.values.forEach { it.clear() }
        retryQueues.clear()
        deviceManager.close()
    }

    // ─── HTTP 分发 ────────────────────────────────────────────────────────────

    private fun handleClient(socket: Socket) {
        try {
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) { socket.close(); return }
            val method = parts[0]
            val rawPath = parts[1]
            val path = rawPath.substringBefore("?")
            val query = if (rawPath.contains("?")) rawPath.substringAfter("?") else ""

            val headers = mutableMapOf<String, String>()
            var line = reader.readLine()
            while (!line.isNullOrEmpty()) {
                val idx = line.indexOf(':')
                if (idx > 0) headers[line.substring(0, idx).trim().lowercase()] = line.substring(idx + 1).trim()
                line = reader.readLine()
            }

            val bp = config.basePath
            val upgrade = headers["upgrade"]?.lowercase()

            if (upgrade == "websocket" && path == "$bp/ws") {
                val token = query.split("&").firstOrNull { it.startsWith("token=") }?.substringAfter("token=")
                handleWebSocketUpgrade(socket, headers, token)
                return
            }

            val body = if (method == "POST") {
                val len = headers["content-length"]?.toIntOrNull() ?: 0
                val buf = CharArray(len); reader.read(buf, 0, len); String(buf)
            } else ""

            val (status, resp) = when {
                path == "$bp/register" && method == "POST" -> handleRegister(body)
                path == "$bp/health" && method == "GET"    -> 200 to """{"status":"ok","timestamp":${System.currentTimeMillis()}}"""
                path == "$bp/stats" && method == "GET"     -> 200 to statsJson()
                else -> 404 to """{"error":"Not found"}"""
            }
            sendHttp(socket, status, resp)
        } catch (e: Exception) {
            Log.e(TAG, "handleClient error", e)
            try { socket.close() } catch (_: Exception) {}
        }
    }

    private fun sendHttp(socket: Socket, status: Int, body: String) {
        try {
            val bytes = body.toByteArray()
            val text = "HTTP/1.1 $status OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
            val out = socket.getOutputStream()
            out.write(text.toByteArray())
            out.write(bytes)
            out.flush()
            socket.close()
        } catch (_: Exception) {}
    }

    // ─── 注册 ─────────────────────────────────────────────────────────────────

    private fun handleRegister(body: String): Pair<Int, String> {
        return try {
            val j = JSONObject(body)
            val typeStr = j.optString("type")
            val deviceId = j.optString("deviceId")
            val masterDeviceId = j.optString("masterDeviceId", deviceId)
            if (typeStr.isEmpty() || deviceId.isEmpty())
                return 400 to """{"success":false,"error":"Missing type or deviceId"}"""
            val type = if (typeStr == "master") DeviceType.MASTER else DeviceType.SLAVE
            val token = UUID.randomUUID().toString().replace("-", "")
            val info = DeviceInfo(type, deviceId, masterDeviceId, token)
            val err = deviceManager.preRegister(info)
            if (err != null) return 400 to """{"success":false,"error":"$err"}"""
            200 to """{"success":true,"token":"$token","deviceInfo":{"deviceType":"$typeStr","deviceId":"$deviceId"}}"""
        } catch (e: Exception) {
            400 to """{"success":false,"error":"${e.message}"}"""
        }
    }

    // ─── WebSocket 握手 ───────────────────────────────────────────────────────

    private fun handleWebSocketUpgrade(socket: Socket, headers: Map<String, String>, token: String?) {
        val wsKey = headers["sec-websocket-key"] ?: run { socket.close(); return }
        val accept = Base64.getEncoder().encodeToString(
            MessageDigest.getInstance("SHA-1").digest(
                (wsKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray()
            )
        )
        val response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: $accept\r\n\r\n"
        socket.getOutputStream().write(response.toByteArray())
        socket.getOutputStream().flush()

        val session = WsSession(socket)
        dedicatedThread { handleWsSession(session, socket, token) }
    }

    // ─── WebSocket 消息循环 ───────────────────────────────────────────────────

    private fun handleWsSession(session: WsSession, socket: Socket, token: String?) {
        var deviceInfo: DeviceInfo? = null
        try {
            if (token == null) { session.close(); return }
            val (info, err) = deviceManager.connect(session, token)
            if (err != null || info == null) { session.close(); return }
            deviceInfo = info
            onDeviceConnected(info, session)

            val frameReader = WsFrameReader(socket.getInputStream()) { session.sendPong(it) }
            while (session.isOpen) {
                val text = frameReader.readFrame() ?: break
                val json = try { JSONObject(text) } catch (_: Exception) { continue }
                if (json.optString("type") == "__system_heartbeat_ack") {
                    deviceManager.updateHeartbeat(session.key); continue
                }
                routeMessage(session, json, text)
            }
        } catch (_: Exception) {
        } finally {
            deviceInfo?.let { onDeviceDisconnected(it) }
        }
    }

    private fun routeMessage(session: WsSession, json: JSONObject, raw: String) {
        val (type, _, masterId) = deviceManager.findBySocket(session.key) ?: return
        val peer = deviceManager.getPeer(masterId, type)
        if (peer == null || !trySend(peer.socket, raw)) {
            enqueueRetry(masterId, raw)
        }
    }

    private fun trySend(socket: WsSession, raw: String): Boolean {
        if (!socket.isOpen) return false
        socket.send(raw)
        return socket.isOpen
    }

    private inner class RetryQueue(val masterDeviceId: String, val timeoutMs: Long) {
        private val messages = java.util.concurrent.CopyOnWriteArrayList<String>()
        private var firstEnqueuedAt = 0L
        fun enqueue(raw: String) {
            if (messages.isEmpty()) firstEnqueuedAt = System.currentTimeMillis()
            messages.add(raw)
        }
        fun flush() {
            val slave = deviceManager.getSlave(masterDeviceId) ?: return
            val pending = messages.toList(); messages.clear(); firstEnqueuedAt = 0L
            pending.forEach { slave.socket.send(it) }
        }
        fun clear() { messages.clear(); firstEnqueuedAt = 0L }
        fun isTimedOut(now: Long) = firstEnqueuedAt > 0L && now - firstEnqueuedAt > timeoutMs
    }

    private val retryQueues = ConcurrentHashMap<String, RetryQueue>()

    private fun enqueueRetry(masterDeviceId: String, raw: String) {
        val rc = deviceManager.getRuntimeConfig(masterDeviceId)
        retryQueues.getOrPut(masterDeviceId) { RetryQueue(masterDeviceId, rc.retryCacheTimeout) }.enqueue(raw)
    }

    private fun onDeviceConnected(info: DeviceInfo, session: WsSession) {
        Log.i(TAG, "[${info.type}] connected: ${info.deviceId}")
        if (info.type == DeviceType.SLAVE) {
            notifyMaster(info.masterDeviceId, "__system_slave_connected",
                """{"deviceId":"${info.deviceId}","connectedAt":${System.currentTimeMillis()}}""")
            flushRetryQueue(info.masterDeviceId)
        }
    }

    private fun onDeviceDisconnected(info: DeviceInfo) {
        Log.i(TAG, "[${info.type}] disconnected: ${info.deviceId}")
        if (info.type == DeviceType.MASTER) {
            retryQueues.remove(info.masterDeviceId)?.clear()
            deviceManager.disconnectMaster(info.masterDeviceId)
        } else {
            retryQueues.remove(info.masterDeviceId)?.clear()
            notifyMaster(info.masterDeviceId, "__system_slave_disconnected",
                """{"deviceId":"${info.deviceId}","disconnectedAt":${System.currentTimeMillis()}}""")
            deviceManager.disconnectSlave(info.masterDeviceId)
        }
    }

    private fun notifyMaster(masterDeviceId: String, type: String, dataJson: String) {
        val msg = """{"from":"__system","id":"${UUID.randomUUID()}","type":"$type","data":$dataJson}"""
        deviceManager.getMaster(masterDeviceId)?.socket?.send(msg)
    }

    private fun flushRetryQueue(masterDeviceId: String) {
        val queue = retryQueues[masterDeviceId] ?: return
        queue.flush()
        if (deviceManager.getSlave(masterDeviceId) != null) retryQueues.remove(masterDeviceId)
    }

    // ─── 心跳 ─────────────────────────────────────────────────────────────────

    fun sendHeartbeat() {
        val msg = """{"from":"__system","id":"${UUID.randomUUID()}","type":"__system_heartbeat","data":{"timestamp":${System.currentTimeMillis()}}}"""
        deviceManager.getAllSessions().forEach { (s, _) -> s.send(msg) }
    }

    fun checkHeartbeatTimeouts() {
        deviceManager.checkHeartbeatTimeouts().forEach { (type, deviceId, masterId) ->
            Log.w(TAG, "[$type] $deviceId heartbeat timeout")
            if (type == DeviceType.MASTER) {
                retryQueues.remove(masterId)?.clear()
                deviceManager.disconnectMaster(masterId)
            } else {
                retryQueues.remove(masterId)?.clear()
                notifyMaster(masterId, "__system_slave_disconnected",
                    """{"deviceId":"$deviceId","reason":"heartbeat_timeout"}""")
                deviceManager.disconnectSlave(masterId)
            }
        }
    }

    fun checkRetryQueueTimeouts() {
        val now = System.currentTimeMillis()
        retryQueues.entries.removeIf { (masterId, queue) ->
            if (!queue.isTimedOut(now)) return@removeIf false
            Log.w(TAG, "RetryQueue timeout for $masterId, disconnecting slave")
            queue.clear()
            deviceManager.disconnectSlave(masterId)
            notifyMaster(masterId, "__system_slave_disconnected",
                """{"reason":"retry_cache_timeout"}""")
            true
        }
    }

    private fun statsJson(): String {
        val s = deviceManager.getStats()
        return """{"masterCount":${s.masterCount},"slaveCount":${s.slaveCount},"pendingCount":${s.pendingCount},"uptime":${s.uptime}}"""
    }

    fun getAddresses(): List<Pair<String, String>> {
        val result = mutableListOf<Pair<String, String>>()
        try {
            java.net.NetworkInterface.getNetworkInterfaces()?.toList()?.forEach { iface ->
                if (!iface.isUp || iface.isLoopback) return@forEach
                iface.inetAddresses.toList().filterIsInstance<java.net.Inet4Address>().forEach { addr ->
                    result.add(iface.displayName to "http://${addr.hostAddress}:${config.port}${config.basePath}")
                }
            }
        } catch (_: Exception) {}
        if (result.isEmpty()) result.add("localhost" to "http://localhost:${config.port}${config.basePath}")
        return result
    }
}
