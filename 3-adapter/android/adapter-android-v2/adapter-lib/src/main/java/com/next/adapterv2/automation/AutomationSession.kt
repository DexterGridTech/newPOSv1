package com.next.adapterv2.automation

import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.Socket
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

class AutomationSession internal constructor(
  private val socket: Socket,
  val sessionId: String = UUID.randomUUID().toString(),
) {
  private val closed = AtomicBoolean(false)
  private val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
  private val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))

  val isOpen: Boolean
    get() = !closed.get() && !socket.isClosed

  fun readMessage(): String? {
    val line = reader.readLine() ?: return null
    return AutomationMessageCodec.decode(line)
  }

  fun send(message: String) {
    if (!isOpen) return
    synchronized(writer) {
      writer.write(String(AutomationMessageCodec.encode(message), Charsets.UTF_8))
      writer.flush()
    }
  }

  fun close() {
    if (!closed.compareAndSet(false, true)) return
    runCatching { reader.close() }
    runCatching { writer.close() }
    runCatching { socket.close() }
  }
}

