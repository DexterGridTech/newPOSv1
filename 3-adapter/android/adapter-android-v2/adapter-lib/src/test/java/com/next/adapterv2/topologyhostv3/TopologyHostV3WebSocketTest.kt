package com.next.adapterv2.topologyhostv3

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class TopologyHostV3WebSocketTest {
  @Test
  fun frameReaderHandlesPingAndThenReturnsMaskedTextFrame() {
    val input = ByteArrayInputStream(
      buildFrame(opcode = 0x9, payload = "hb".toByteArray(Charsets.UTF_8)) +
        buildFrame(opcode = 0x1, payload = "hello".toByteArray(Charsets.UTF_8)),
    )
    var pingPayload: ByteArray? = null
    val reader = TopologyHostV3WsFrameReader(
      input = input,
      onPing = { payload -> pingPayload = payload },
    )

    assertEquals("hello", reader.readFrame())
    assertArrayEquals("hb".toByteArray(Charsets.UTF_8), pingPayload)
  }

  private fun buildFrame(opcode: Int, payload: ByteArray): ByteArray {
    val mask = byteArrayOf(0x12, 0x34, 0x56, 0x78)
    val frame = ByteArrayOutputStream()
    frame.write(0x80 or opcode)
    frame.write(0x80 or payload.size)
    frame.write(mask)
    payload.forEachIndexed { index, byte ->
      frame.write(byte.toInt() xor mask[index % mask.size].toInt())
    }
    return frame.toByteArray()
  }
}
