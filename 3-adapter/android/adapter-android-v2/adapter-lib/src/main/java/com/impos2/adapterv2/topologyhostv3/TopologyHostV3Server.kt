package com.impos2.adapterv2.topologyhostv3

import android.content.Context
import com.impos2.adapterv2.device.DeviceManager
import com.impos2.adapterv2.logger.LogManager
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class TopologyHostV3Server(
  private val context: Context,
  private val config: TopologyHostV3Config,
  private val logger: LogManager,
) {
  private val runtime = TopologyHostV3Runtime(config.heartbeatTimeoutMs)
  private val socketSessions = ConcurrentHashMap<String, TopologyHostV3WsSession>()
  private val executor = Executors.newCachedThreadPool()
  private val heartbeatScheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()

  @Volatile
  private var serverSocket: ServerSocket? = null
  @Volatile
  private var running = false
  @Volatile
  private var lastError: String? = null

  fun start() {
    runtime.setHostRuntime(createHostRuntimeInfo())
    val socket = ServerSocket(config.port, 50, InetAddress.getByName("0.0.0.0"))
    socket.reuseAddress = true
    serverSocket = socket
    running = true
    runtime.markRunning()
    startHeartbeatLoop()
    executor.submit {
      while (running) {
        val client = runCatching { serverSocket?.accept() }.getOrNull() ?: break
        executor.submit { handleClient(client) }
      }
    }
  }

  fun stop() {
    running = false
    runtime.markClosed()
    runCatching { serverSocket?.close() }
    serverSocket = null
    socketSessions.values.forEach { it.close() }
    socketSessions.clear()
    heartbeatScheduler.shutdownNow()
    executor.shutdownNow()
  }

  fun getAddressInfo(): TopologyHostV3AddressInfo {
    val address = serverSocket?.localPort ?: config.port
    val localHttpBaseUrl = "http://127.0.0.1:$address${config.basePath}"
    val localWsUrl = "ws://127.0.0.1:$address${config.basePath}/ws"
    val advertisedHost = resolveAdvertisedHost()
    return TopologyHostV3AddressInfo(
      host = advertisedHost,
      port = address,
      basePath = config.basePath,
      httpBaseUrl = "http://$advertisedHost:$address${config.basePath}",
      wsUrl = "ws://$advertisedHost:$address${config.basePath}/ws",
      bindHost = "0.0.0.0",
      localHttpBaseUrl = localHttpBaseUrl,
      localWsUrl = localWsUrl,
    )
  }

  fun getStatusInfo(): TopologyHostV3StatusInfo {
    return TopologyHostV3StatusInfo(
      state = if (running) TopologyHostV3ServiceState.RUNNING else TopologyHostV3ServiceState.STOPPED,
      addressInfo = if (running) getAddressInfo() else null,
      config = config,
      error = lastError,
    )
  }

  fun getStats(): TopologyHostV3Stats = runtime.getStats()

  fun getDiagnosticsSnapshot(): TopologyHostV3DiagnosticsSnapshot = runtime.getDiagnosticsSnapshot()

  fun replaceFaultRules(rules: List<TopologyHostV3FaultRule>): Int = runtime.replaceFaultRules(rules)

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
      val path = parts[1].substringBefore("?")
      val headers = readHeaders(reader)
      if (headers["upgrade"]?.lowercase() == "websocket" && path == "${config.basePath}/ws") {
        handleWebSocketUpgrade(socket, headers)
        upgraded = true
        return
      }
      when {
        method == "GET" && path == "${config.basePath}/status" -> sendHttp(socket.getOutputStream(), 200, getStatusInfo().toJson())
        method == "GET" && path == "${config.basePath}/stats" -> sendHttp(socket.getOutputStream(), 200, getStats().toJson())
        method == "GET" && path == "${config.basePath}/diagnostics" -> sendHttp(socket.getOutputStream(), 200, getDiagnosticsSnapshot().toJson())
        method == "POST" && path == "${config.basePath}/fault-rules" -> {
          val body = readRequestBody(reader, headers["content-length"]?.toIntOrNull() ?: 0)
          val json = if (body.isBlank()) JSONObject() else JSONObject(body)
          val rules = json.optJsonArray("rules")?.let { array ->
            buildList {
              for (index in 0 until array.length()) {
                add((array.get(index) as JSONObject).toTopologyHostV3FaultRule())
              }
            }
          } ?: emptyList()
          sendHttp(socket.getOutputStream(), 200, JSONObject().put("success", true).put("ruleCount", replaceFaultRules(rules)))
        }
        method == "DELETE" && path == "${config.basePath}/fault-rules" ->
          sendHttp(socket.getOutputStream(), 200, JSONObject().put("success", true).put("ruleCount", replaceFaultRules(emptyList())))
        else -> sendHttp(socket.getOutputStream(), 404, JSONObject().put("error", "not-found"))
      }
    } catch (error: Exception) {
      lastError = error.message
      runCatching { sendHttp(socket.getOutputStream(), 500, JSONObject().put("error", "internal-server-error")) }
    } finally {
      if (!upgraded) {
        runCatching { socket.close() }
      }
    }
  }

  private fun handleWebSocketUpgrade(socket: Socket, headers: Map<String, String>) {
    val key = headers["sec-websocket-key"] ?: throw IllegalArgumentException("sec-websocket-key is required")
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

    val session = TopologyHostV3WsSession(socket)
    val connectionId = TopologyHostV3Ids.createConnectionId()
    socketSessions[connectionId] = session

    executor.submit {
      try {
        val frameReader = TopologyHostV3WsFrameReader(
          socket.getInputStream(),
          onPing = { payload ->
            runtime.recordInboundFrame(connectionId)
            session.sendPong(payload)
          },
          onPong = {
            runtime.recordInboundFrame(connectionId)
          },
        )
        while (running && session.isOpen) {
          val text = frameReader.readFrame() ?: break
          runtime.recordInboundFrame(connectionId)
          handleIncomingMessage(connectionId, JSONObject(text))
        }
      } finally {
        runtime.detachConnection(connectionId)
        socketSessions.remove(connectionId)?.close()
      }
    }
  }

  private fun startHeartbeatLoop() {
    heartbeatScheduler.scheduleAtFixedRate(
      {
        if (!running) {
          return@scheduleAtFixedRate
        }
        val now = System.currentTimeMillis()
        socketSessions.forEach { (connectionId, session) ->
          if (session.isOpen) {
            runtime.recordHeartbeatSent(connectionId, now)
            session.sendPing(now.toString().toByteArray(Charsets.UTF_8))
          }
        }
        runtime.collectTimedOutConnections(now).forEach { connectionId ->
          socketSessions.remove(connectionId)?.close()
          runtime.detachConnection(connectionId)
        }
      },
      config.heartbeatIntervalMs,
      config.heartbeatIntervalMs,
      TimeUnit.MILLISECONDS,
    )
  }

  private fun handleIncomingMessage(connectionId: String, message: JSONObject) {
    when (message.optString("type")) {
      "hello" -> {
        val hello = message.toTopologyHostV3Hello()
        val ack = runtime.processHello(connectionId, hello)
        socketSessions[connectionId]?.send(ack.toJson().toString())
        val peerRuntime = runtime.getPeerUpdate(hello.runtime.instanceMode)
        if (peerRuntime != null) {
          val peerConnectionId = runtime.getConnectionIdByNodeId(peerRuntime.nodeId)
          if (peerConnectionId != null && peerConnectionId != connectionId) {
            socketSessions[peerConnectionId]?.send(
              TopologyHostV3HelloAck(
                helloId = "${hello.helloId}:peer-update",
                accepted = true,
                sessionId = ack.sessionId,
                peerRuntime = hello.runtime,
                hostTime = System.currentTimeMillis(),
              ).toJson().toString(),
            )
          }
        }
      }
      "state-snapshot",
      "state-update",
      "command-dispatch",
      "command-event",
      "request-snapshot" -> relayMessage(message)
    }
  }

  private fun relayMessage(message: JSONObject) {
    val channel = message.optString("type")
    if (runtime.shouldDrop(channel)) {
      return
    }
    val targetNodeId = runtime.resolveRelayTarget(message) ?: return
    val targetConnectionId = runtime.getConnectionIdByNodeId(targetNodeId) ?: return
    if (runtime.shouldDisconnect(channel)) {
      socketSessions.remove(targetConnectionId)?.close()
      runtime.detachConnection(targetConnectionId)
      return
    }
    val delayMs = runtime.resolveDelayMs(channel)
    val sender = {
      socketSessions[targetConnectionId]?.send(message.toString())
    }
    if (delayMs > 0) {
      executor.submit {
        Thread.sleep(delayMs)
        sender()
      }
    } else {
      sender()
    }
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
    val bytes = body.toString().toByteArray(Charsets.UTF_8)
    val statusText = when (status) {
      200 -> "OK"
      400 -> "Bad Request"
      404 -> "Not Found"
      500 -> "Internal Server Error"
      else -> "OK"
    }
    val header = buildString {
      append("HTTP/1.1 $status $statusText\r\n")
      append("Content-Type: application/json\r\n")
      append("Access-Control-Allow-Origin: *\r\n")
      append("Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS\r\n")
      append("Access-Control-Allow-Headers: content-type\r\n")
      append("Content-Length: ${bytes.size}\r\n")
      append("Connection: close\r\n\r\n")
    }
    out.write(header.toByteArray(Charsets.UTF_8))
    out.write(bytes)
    out.flush()
  }

  private fun createHostRuntimeInfo(): TopologyHostV3RuntimeInfo {
    val deviceId = runCatching { DeviceManager.getInstance(context).getDeviceInfo().id }
      .getOrElse { "android-topology-host-v3" }
    return TopologyHostV3RuntimeInfo(
      nodeId = "node_android_host_v3_$deviceId",
      deviceId = deviceId,
      instanceMode = "MASTER",
      displayMode = "PRIMARY",
      standalone = true,
      protocolVersion = TopologyHostV3Defaults.DEFAULT_PROTOCOL_VERSION,
      capabilities = listOf("state-sync", "command-relay", "request-mirror"),
    )
  }

  private fun resolveAdvertisedHost(): String {
    return runCatching {
      NetworkInterface.getNetworkInterfaces()
        ?.asSequence()
        ?.filter { it.isUp && !it.isLoopback && !it.name.startsWith("lo") }
        ?.flatMap { iface -> iface.inetAddresses.asSequence() }
        ?.firstOrNull { address ->
          address is Inet4Address && !address.isLoopbackAddress && !address.hostAddress.isNullOrBlank()
        }
        ?.hostAddress
        ?.takeIf { it.isNotBlank() }
    }.getOrNull()
      ?: "127.0.0.1"
  }
}
