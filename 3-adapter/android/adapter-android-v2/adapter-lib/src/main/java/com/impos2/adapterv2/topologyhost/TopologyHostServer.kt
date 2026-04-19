package com.impos2.adapterv2.topologyhost

import android.content.Context
import android.util.Log
import com.impos2.adapterv2.device.DeviceManager
import com.impos2.adapterv2.logger.LogManager
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * Android 内置 topology host 的 HTTP / WebSocket 承载层。
 *
 * 这层故意只做传输承载：
 * - HTTP route 与当前 mock topology host 协议对齐
 * - WS message type 与 mock host 对齐
 * - ticket/session/relay 真相全部委托给 [TopologyHostRuntime]
 */
class TopologyHostServer(
  private val context: Context,
  private val config: TopologyHostConfig,
  private val logger: LogManager,
) {
  companion object {
    private const val TAG = "TopologyHostServer"
  }

  private val requestCount = AtomicLong(0)
  private val failedRequestCount = AtomicLong(0)
  private val rejectedRequestCount = AtomicLong(0)
  private val dedicatedThreads = CopyOnWriteArrayList<Thread>()
  private val socketSessions = ConcurrentSessionRegistry()
  private val executor = ThreadPoolExecutor(
    4,
    16,
    60L,
    TimeUnit.SECONDS,
    LinkedBlockingQueue(128),
  )
  private val heartbeatScheduler = Executors.newSingleThreadScheduledExecutor()
  private val runtime = TopologyHostRuntime(
    hostRuntimeInfo = createHostRuntimeInfo(),
    config = config,
    logger = logger,
  )

  private var serverSocket: ServerSocket? = null
  @Volatile
  private var running = false
  @Volatile
  private var startedAt: Long = 0L
  @Volatile
  private var stoppedAt: Long = 0L
  @Volatile
  private var lastError: String? = null

  fun start() {
    val socket = ServerSocket(config.port, 50, InetAddress.getByName("127.0.0.1"))
    socket.reuseAddress = true
    serverSocket = socket
    running = true
    startedAt = System.currentTimeMillis()
    dedicatedThread("topology-host-accept-${config.port}") {
      while (running) {
        try {
          val client = serverSocket?.accept() ?: break
          try {
            executor.submit { handleClient(client) }
          } catch (error: RejectedExecutionException) {
            rejectedRequestCount.incrementAndGet()
            recordError("request rejected: ${error.message ?: "executor saturated"}", error)
            closeQuietly(client)
          }
        } catch (error: Exception) {
          if (running) {
            recordError("accept failed: ${error.message}", error)
          }
          break
        }
      }
    }
    heartbeatScheduler.scheduleAtFixedRate({
      runCatching {
        sendHeartbeat()
        runtime.expireIdleConnections().forEach { connection ->
          socketSessions.close(connection.connectionId)
        }
      }.onFailure { error ->
        recordError("heartbeat task failed: ${error.message}", error)
      }
    }, config.heartbeatIntervalMs, config.heartbeatIntervalMs, TimeUnit.MILLISECONDS)
  }

  fun stop() {
    running = false
    stoppedAt = System.currentTimeMillis()
    closeQuietly(serverSocket)
    serverSocket = null
    dedicatedThreads.forEach { it.interrupt() }
    dedicatedThreads.clear()
    socketSessions.closeAll()
    heartbeatScheduler.shutdownNow()
    executor.shutdown()
    if (!executor.awaitTermination(3, TimeUnit.SECONDS)) {
      executor.shutdownNow()
    }
  }

  fun getAddressInfo(): TopologyHostAddressInfo {
    return TopologyHostAddressInfo(
      host = "127.0.0.1",
      port = config.port,
      basePath = config.basePath,
      httpBaseUrl = "http://127.0.0.1:${config.port}${config.basePath}",
      wsUrl = "ws://127.0.0.1:${config.port}${config.basePath}/ws",
    )
  }

  fun getStats(): TopologyHostStats = runtime.getStats()

  fun getDiagnosticsSnapshot(): TopologyHostDiagnosticsSnapshot = runtime.getDiagnosticsSnapshot()

  fun issueTicket(
    masterNodeId: String,
    transportUrls: List<String>,
    expiresInMs: Long,
  ): TopologyHostTicketResponse {
    val ticket = runtime.issueTicket(masterNodeId, transportUrls, expiresInMs)
    logger.log(
      TAG,
      JSONObject()
        .put("event", "issue-ticket")
        .put("masterNodeId", masterNodeId)
        .put("sessionId", ticket.sessionId)
        .put("token", ticket.ticket.token)
        .put("transportUrls", transportUrls.toJsonStringArray())
        .toString(),
    )
    return TopologyHostTicketResponse(
      success = true,
      token = ticket.ticket.token,
      sessionId = ticket.sessionId,
      expiresAt = ticket.ticket.expiresAt,
      transportUrls = ticket.ticket.transportUrls,
    )
  }

  fun replaceFaultRules(rules: List<TopologyHostFaultRule>): TopologyHostFaultRuleReplaceResponse {
    runtime.replaceFaultRules(rules)
    return TopologyHostFaultRuleReplaceResponse(success = true, ruleCount = rules.size)
  }

  fun dumpState(): String {
    return buildString {
      append("running=")
      append(running)
      append(", address=")
      append(getAddressInfo())
      append(", startedAt=")
      append(startedAt)
      append(", stoppedAt=")
      append(stoppedAt)
      append(", requestCount=")
      append(requestCount.get())
      append(", failedRequestCount=")
      append(failedRequestCount.get())
      append(", rejectedRequestCount=")
      append(rejectedRequestCount.get())
      append(", activeSockets=")
      append(socketSessions.size())
      append(", lastError=")
      append(lastError ?: "null")
    }
  }

  private fun handleClient(socket: Socket) {
    var upgraded = false
    try {
      val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
      val requestLine = reader.readLine() ?: return
      val parts = requestLine.split(" ")
      if (parts.size < 2) {
        sendHttp(socket.getOutputStream(), 400, JSONObject().put("error", "bad-request"))
        return
      }

      val method = parts[0]
      val rawPath = parts[1]
      val path = rawPath.substringBefore("?")
      val query = rawPath.substringAfter("?", "")
      val headers = readHeaders(reader)
      val upgrade = headers["upgrade"]?.lowercase()
      if (upgrade == "websocket" && path == "${config.basePath}/ws") {
        handleWebSocketUpgrade(socket, headers)
        upgraded = true
        return
      }

      val body = if (method == "POST" || method == "PUT") {
        readRequestBody(reader, headers["content-length"]?.toIntOrNull() ?: 0)
      } else {
        ""
      }

      requestCount.incrementAndGet()
      routeHttp(socket.getOutputStream(), method, path, query, body)
    } catch (error: Exception) {
      failedRequestCount.incrementAndGet()
      recordError("handleClient failed: ${error.message}", error)
      runCatching {
        sendHttp(socket.getOutputStream(), 500, JSONObject().put("error", "internal-server-error"))
      }
    } finally {
      if (!upgraded) {
        closeQuietly(socket)
      }
    }
  }

  private fun routeHttp(out: OutputStream, method: String, path: String, query: String, body: String) {
    if (method == "OPTIONS") {
      sendRawHttp(out, 200, ByteArray(0), "application/json")
      return
    }

    if (method == "GET" && path == "${config.basePath}/health") {
      sendHttp(
        out,
        200,
        JSONObject()
          .put("status", "ok")
          .put("now", System.currentTimeMillis())
          .put("moduleName", TOPOLOGY_HOST_MODULE_NAME),
      )
      return
    }

    if (method == "GET" && path == "${config.basePath}/stats") {
      sendHttp(out, 200, getStats().toJson())
      return
    }

    if (method == "POST" && path == "${config.basePath}/tickets") {
      val request = if (body.isBlank()) JSONObject() else JSONObject(body)
      val masterNodeId = request.optStringOrNull("masterNodeId")
      if (masterNodeId.isNullOrBlank()) {
        sendHttp(out, 400, TopologyHostTicketResponse(success = false, error = "masterNodeId is required").toJson())
        return
      }
      val ticket = runtime.issueTicket(
        masterNodeId = masterNodeId,
        transportUrls = request.optJsonArray("transportUrls")?.toStringList() ?: listOf(getAddressInfo().wsUrl),
        expiresInMs = request.optLongOrNull("expiresInMs") ?: config.defaultTicketExpiresInMs,
      )
      sendHttp(
        out,
        200,
        TopologyHostTicketResponse(
          success = true,
          token = ticket.ticket.token,
          sessionId = ticket.sessionId,
          expiresAt = ticket.ticket.expiresAt,
          transportUrls = ticket.ticket.transportUrls,
        ).toJson(),
      )
      return
    }

    if (method == "PUT" && path == "${config.basePath}/fault-rules") {
      val request = if (body.isBlank()) JSONObject() else JSONObject(body)
      val rules = request.optJsonArray("rules")
        ?.toJsonObjectList()
        ?.map { it.toTopologyHostFaultRule() }
        ?: emptyList()
      sendHttp(out, 200, replaceFaultRules(rules).let { JSONObject().put("success", it.success).put("ruleCount", it.ruleCount) })
      return
    }

    sendHttp(out, 404, JSONObject().put("error", "not-found").put("path", path).put("query", query))
  }

  private fun handleWebSocketUpgrade(socket: Socket, headers: Map<String, String>) {
    val key = headers["sec-websocket-key"]
      ?: throw IllegalArgumentException("sec-websocket-key is required")
    val accept = Base64.getEncoder().encodeToString(
      MessageDigest.getInstance("SHA-1")
        .digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray(Charsets.ISO_8859_1)),
    )
    val response = buildString {
      append("HTTP/1.1 101 Switching Protocols\r\n")
      append("Upgrade: websocket\r\n")
      append("Connection: Upgrade\r\n")
      append("Sec-WebSocket-Accept: ")
      append(accept)
      append("\r\n\r\n")
    }
    socket.getOutputStream().write(response.toByteArray(Charsets.UTF_8))
    socket.getOutputStream().flush()

    val session = TopologyHostWsSession(socket)
    val connectionId = TopologyHostIds.createConnectionId()
    logger.log(
      TAG,
      JSONObject()
        .put("event", "ws-upgrade")
        .put("connectionId", connectionId)
        .put("path", "${config.basePath}/ws")
        .toString(),
    )
    socketSessions.put(connectionId, session)
    readWebSocketLoop(connectionId, session, socket)
  }

  private fun readWebSocketLoop(connectionId: String, session: TopologyHostWsSession, socket: Socket) {
    try {
      val reader = TopologyHostWsFrameReader(socket.getInputStream()) { payload ->
        session.sendPong(payload)
      }
      while (running && session.isOpen) {
        val text = reader.readFrame() ?: break
        val outputs = handleIncomingMessage(connectionId, JSONObject(text))
        sendOutgoingMessages(outputs)
      }
    } catch (error: Exception) {
      recordError("ws loop failed: ${error.message}", error)
    } finally {
      runtime.detachConnection(connectionId, "socket-closed")
      socketSessions.remove(connectionId)
      session.close()
    }
  }

  private fun handleIncomingMessage(connectionId: String, message: JSONObject): List<Pair<String, JSONObject>> {
    logger.debug(
      TAG,
      JSONObject()
        .put("event", "ws-incoming")
        .put("connectionId", connectionId)
        .put("type", message.optString("type"))
        .put("message", message)
        .toString(),
    )
    return when (message.optString("type")) {
      "__host_heartbeat_ack" -> {
        runtime.recordHeartbeat(connectionId, message.optLong("timestamp", System.currentTimeMillis()))
        emptyList()
      }
      "node-hello" -> {
        val hello = message.optJsonObject("hello")?.toTopologyHostNodeHello()
          ?: throw IllegalArgumentException("hello is required")
        val result = runtime.processHello(connectionId, hello)
        val ackMessage = JSONObject()
          .put("type", "node-hello-ack")
          .put("ack", result.ack.toJson())
        val out = mutableListOf(connectionId to ackMessage)
        out += runtime.drainConnectionOutbox(connectionId).map { it.connectionId to deliveryToMessage(it) }
        out
      }
      "resume-begin" -> {
        val outputs = runtime.handleResumeBegin(
          sessionId = message.optString("sessionId"),
          nodeId = message.optString("nodeId"),
          timestamp = message.optLong("timestamp", System.currentTimeMillis()),
        )
        outputs.map { it.connectionId to deliveryToMessage(it) }
      }
      "resume-complete" -> {
        runtime.handleResumeComplete(
          connectionId = connectionId,
          sessionId = message.optString("sessionId"),
          nodeId = message.optString("nodeId"),
          timestamp = message.optLong("timestamp", System.currentTimeMillis()),
        ).map { it.connectionId to deliveryToMessage(it) }
      }
      "command-dispatch",
      "command-event",
      "projection-mirror",
      "request-lifecycle-snapshot",
      "state-sync-summary",
      "state-sync-diff",
      "state-sync-commit-ack" -> {
        val envelope = message.optJsonObject("envelope") ?: throw IllegalArgumentException("envelope is required")
        val relayResult = runtime.relayEnvelope(connectionId, envelope)
        relayResult.disconnectedConnectionIds.forEach { socketSessions.close(it) }
        runtime.flushAllConnectionOutboxes().map { it.connectionId to deliveryToMessage(it) }
      }
      else -> emptyList()
    }
  }

  private fun sendOutgoingMessages(outputs: List<Pair<String, JSONObject>>) {
    outputs.forEach { (connectionId, message) ->
      logger.debug(
        TAG,
        JSONObject()
          .put("event", "ws-outgoing")
          .put("connectionId", connectionId)
          .put("type", message.optString("type"))
          .put("message", message)
          .toString(),
      )
      socketSessions.get(connectionId)?.send(message.toString())
    }
  }

  private fun sendHeartbeat() {
    val timestamp = System.currentTimeMillis()
    socketSessions.forEach { (_, session) ->
      session.send(JSONObject().put("type", "__host_heartbeat").put("timestamp", timestamp).toString())
    }
  }

  private fun deliveryToMessage(delivery: TopologyHostRelayDelivery): JSONObject {
    if (deliveryMessageType(delivery) == "resume-begin") {
      val envelope = delivery.envelope
      return JSONObject()
        .put("type", "resume-begin")
        .put("sessionId", envelope.optString("sessionId"))
        .put("nodeId", envelope.optString("sourceNodeId"))
        .put("timestamp", envelope.optLong("timestamp", System.currentTimeMillis()))
    }
    return JSONObject()
      .put("type", deliveryMessageType(delivery))
      .put("envelope", delivery.envelope)
  }

  private fun deliveryMessageType(delivery: TopologyHostRelayDelivery): String {
    val envelope = delivery.envelope
    return when {
      delivery.channel == TopologyHostRelayChannel.DISPATCH -> "command-dispatch"
      envelope.has("projection") -> "projection-mirror"
      envelope.has("snapshot") -> "request-lifecycle-snapshot"
      envelope.has("summaryBySlice") -> "state-sync-summary"
      envelope.has("diffBySlice") -> "state-sync-diff"
      envelope.has("committedAt") -> "state-sync-commit-ack"
      envelope.has("timestamp") -> "resume-begin"
      else -> "command-event"
    }
  }

  private fun createHostRuntimeInfo(): TopologyHostRuntimeInfo {
    val deviceId = runCatching { DeviceManager.getInstance(context).getDeviceInfo().id }
      .getOrElse { "android-topology-host" }
    return TopologyHostRuntimeInfo(
      nodeId = "node_android_host_$deviceId",
      deviceId = deviceId,
      role = "master",
      platform = "android",
      product = "new-pos-android-topology-host",
      assemblyAppId = context.packageName,
      assemblyVersion = "1.0.0",
      buildNumber = 1,
      bundleVersion = "1",
      runtimeVersion = TopologyHostDefaults.DEFAULT_RUNTIME_VERSION,
      protocolVersion = TopologyHostDefaults.DEFAULT_PROTOCOL_VERSION,
      capabilities = listOf(
        "host-pairing",
        "host-observe",
        "fault-injection",
        "dispatch-relay",
        "projection-mirror",
        "state-sync",
      ),
    )
  }

  private fun readHeaders(reader: BufferedReader): Map<String, String> {
    val headers = linkedMapOf<String, String>()
    var line = reader.readLine()
    while (!line.isNullOrEmpty()) {
      val index = line.indexOf(':')
      if (index > 0) {
        headers[line.substring(0, index).trim().lowercase()] = line.substring(index + 1).trim()
      }
      line = reader.readLine()
    }
    return headers
  }

  private fun readRequestBody(reader: BufferedReader, contentLength: Int): String {
    if (contentLength <= 0) return ""
    val buffer = CharArray(contentLength)
    var offset = 0
    while (offset < contentLength) {
      val read = reader.read(buffer, offset, contentLength - offset)
      if (read < 0) break
      offset += read
    }
    return String(buffer, 0, offset)
  }

  private fun sendHttp(out: OutputStream, status: Int, body: JSONObject) {
    sendRawHttp(out, status, body.toString().toByteArray(Charsets.UTF_8), "application/json")
  }

  private fun sendRawHttp(out: OutputStream, status: Int, bytes: ByteArray, contentType: String) {
    val statusText = when (status) {
      200 -> "OK"
      400 -> "Bad Request"
      404 -> "Not Found"
      500 -> "Internal Server Error"
      else -> "OK"
    }
    val header = buildString {
      append("HTTP/1.1 ")
      append(status)
      append(' ')
      append(statusText)
      append("\r\nContent-Type: ")
      append(contentType)
      append("\r\nAccess-Control-Allow-Origin: *")
      append("\r\nAccess-Control-Allow-Methods: GET,POST,PUT,OPTIONS")
      append("\r\nAccess-Control-Allow-Headers: content-type")
      append("\r\nContent-Length: ")
      append(bytes.size)
      append("\r\nConnection: close\r\n\r\n")
    }
    out.write(header.toByteArray(Charsets.UTF_8))
    out.write(bytes)
    out.flush()
  }

  private fun dedicatedThread(name: String, block: () -> Unit): Thread {
    return Thread(block, name).also {
      it.isDaemon = true
      it.start()
      dedicatedThreads += it
    }
  }

  private fun recordError(message: String, error: Throwable? = null) {
    lastError = message
    if (error == null) {
      Log.e(TAG, message)
      logger.error(TAG, message)
    } else {
      Log.e(TAG, message, error)
      logger.error(TAG, "$message ${error.stackTraceToString()}")
    }
  }

  private fun closeQuietly(socket: Socket?) {
    try {
      socket?.close()
    } catch (_: Exception) {
    }
  }

  private fun closeQuietly(socket: ServerSocket?) {
    try {
      socket?.close()
    } catch (_: Exception) {
    }
  }
}

private class ConcurrentSessionRegistry {
  private val sessions = java.util.concurrent.ConcurrentHashMap<String, TopologyHostWsSession>()

  fun put(connectionId: String, session: TopologyHostWsSession) {
    sessions[connectionId] = session
  }

  fun get(connectionId: String): TopologyHostWsSession? = sessions[connectionId]

  fun remove(connectionId: String) {
    sessions.remove(connectionId)
  }

  fun close(connectionId: String) {
    sessions.remove(connectionId)?.close()
  }

  fun closeAll() {
    sessions.values.forEach { it.close() }
    sessions.clear()
  }

  fun size(): Int = sessions.size

  fun forEach(block: (Map.Entry<String, TopologyHostWsSession>) -> Unit) {
    sessions.entries.forEach(block)
  }
}
