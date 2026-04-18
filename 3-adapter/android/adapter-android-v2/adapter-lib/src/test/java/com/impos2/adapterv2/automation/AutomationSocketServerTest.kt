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

  private fun freePort(): Int {
    ServerSocket(0).use { socket ->
      return socket.localPort
    }
  }
}

