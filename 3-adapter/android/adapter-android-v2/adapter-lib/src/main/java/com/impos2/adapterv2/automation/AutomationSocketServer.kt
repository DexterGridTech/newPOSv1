package com.impos2.adapterv2.automation

import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

data class AutomationSocketServerConfig(
  val port: Int = 18_584,
)

data class AutomationSocketAddressInfo(
  val host: String,
  val port: Int,
)

data class AutomationSocketServerStatus(
  val running: Boolean,
  val host: String,
  val port: Int,
  val activeSessionCount: Int,
  val acceptedSessionCount: Long,
  val receivedMessageCount: Long,
  val failedMessageCount: Long,
  val startedAt: Long,
  val stoppedAt: Long,
  val lastError: String?,
)

class AutomationSocketServer(
  private val config: AutomationSocketServerConfig,
  private val bridge: AutomationHostBridge,
) {
  private val sessions = ConcurrentHashMap<String, AutomationSession>()
  private val acceptedSessionCount = AtomicLong(0L)
  private val receivedMessageCount = AtomicLong(0L)
  private val failedMessageCount = AtomicLong(0L)
  private val executor: ExecutorService = Executors.newCachedThreadPool(AutomationThreadFactory())

  @Volatile private var serverSocket: ServerSocket? = null
  @Volatile private var running = false
  @Volatile private var startedAt = 0L
  @Volatile private var stoppedAt = 0L
  @Volatile private var lastError: String? = null

  fun start(): AutomationSocketAddressInfo {
    if (running) {
      return getAddressInfo()
    }

    val socket = ServerSocket(config.port, 50, InetAddress.getByName("127.0.0.1"))
    socket.reuseAddress = true
    serverSocket = socket
    running = true
    startedAt = System.currentTimeMillis()
    stoppedAt = 0L
    lastError = null

    executor.execute {
      while (running) {
        try {
          val client = serverSocket?.accept() ?: break
          executor.execute { handleClient(client) }
        } catch (error: Exception) {
          if (running) {
            lastError = error.message ?: error.javaClass.name
          }
          break
        }
      }
    }

    return getAddressInfo()
  }

  fun stop() {
    running = false
    stoppedAt = System.currentTimeMillis()
    runCatching { serverSocket?.close() }
    serverSocket = null
    sessions.values.forEach { it.close() }
    sessions.clear()
    executor.shutdownNow()
    executor.awaitTermination(2, TimeUnit.SECONDS)
  }

  fun getAddressInfo(): AutomationSocketAddressInfo = AutomationSocketAddressInfo(
    host = "127.0.0.1",
    port = config.port,
  )

  fun getStatus(): AutomationSocketServerStatus = AutomationSocketServerStatus(
    running = running,
    host = "127.0.0.1",
    port = config.port,
    activeSessionCount = sessions.size,
    acceptedSessionCount = acceptedSessionCount.get(),
    receivedMessageCount = receivedMessageCount.get(),
    failedMessageCount = failedMessageCount.get(),
    startedAt = startedAt,
    stoppedAt = stoppedAt,
    lastError = lastError,
  )

  private fun handleClient(socket: Socket) {
    val session = AutomationSession(socket)
    acceptedSessionCount.incrementAndGet()
    sessions[session.sessionId] = session
    try {
      while (running && session.isOpen) {
        val message = session.readMessage() ?: break
        if (message.isBlank()) continue
        receivedMessageCount.incrementAndGet()
        try {
          val response = bridge.onMessage(session, message)
          if (response != null) {
            session.send(response)
          }
        } catch (error: Exception) {
          failedMessageCount.incrementAndGet()
          lastError = error.message ?: error.javaClass.name
          session.send(
            """{"jsonrpc":"2.0","error":{"code":-32603,"message":"${escapeJson(lastError ?: "internal error")}"},"id":null}""",
          )
        }
      }
    } catch (error: Exception) {
      if (running) {
        failedMessageCount.incrementAndGet()
        lastError = error.message ?: error.javaClass.name
      }
    } finally {
      sessions.remove(session.sessionId)
      session.close()
    }
  }

  private fun escapeJson(value: String): String =
    value.replace("\\", "\\\\").replace("\"", "\\\"")

  private class AutomationThreadFactory : ThreadFactory {
    private val sequence = AtomicLong(0L)

    override fun newThread(runnable: Runnable): Thread {
      return Thread(runnable, "adapter-v2-automation-${sequence.incrementAndGet()}").apply {
        isDaemon = true
      }
    }
  }
}

