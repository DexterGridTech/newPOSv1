package com.impos2.adapterv2.automation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ServerSocket
import java.net.Socket

class AutomationSocketServerTest {
  @Test
  fun socketServerRelaysNewlineJsonMessages() {
    val port = freePort()
    val server = AutomationSocketServer(
      AutomationSocketServerConfig(port = port),
      AutomationHostBridge { session, message ->
        """{"sessionId":"${session.sessionId}","echo":$message}"""
      },
    )

    try {
      server.start()
      Socket("127.0.0.1", port).use { socket ->
        val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))
        val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))

        writer.write("""{"jsonrpc":"2.0","method":"session.hello","id":1}""")
        writer.write("\n")
        writer.flush()

        val response = reader.readLine()
        assertTrue(response.contains("sessionId"))
        assertTrue(response.contains("session.hello"))
      }

      val status = server.getStatus()
      assertEquals(1L, status.acceptedSessionCount)
      assertEquals(1L, status.receivedMessageCount)
    } finally {
      server.stop()
    }
  }

  @Test
  fun socketServerCanRestartOnSameInstance() {
    val port = freePort()
    val server = AutomationSocketServer(
      AutomationSocketServerConfig(port = port),
      AutomationHostBridge { session, message ->
        """{"sessionId":"${session.sessionId}","echo":$message}"""
      },
    )

    try {
      server.start()
      assertTrue(sendMessage(port, 1).contains("first"))
      server.stop()

      server.start()
      assertTrue(sendMessage(port, 2).contains("second"))

      val status = server.getStatus()
      assertEquals(2L, status.acceptedSessionCount)
      assertEquals(2L, status.receivedMessageCount)
      assertTrue(status.running)
    } finally {
      server.stop()
    }
  }

  private fun sendMessage(port: Int, id: Int): String {
    Socket("127.0.0.1", port).use { socket ->
      val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))
      val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))

      val label = if (id == 1) "first" else "second"
      writer.write("""{"jsonrpc":"2.0","method":"session.hello","label":"$label","id":$id}""")
      writer.write("\n")
      writer.flush()

      return reader.readLine()
    }
  }

  private fun freePort(): Int {
    ServerSocket(0).use { socket ->
      return socket.localPort
    }
  }
}
