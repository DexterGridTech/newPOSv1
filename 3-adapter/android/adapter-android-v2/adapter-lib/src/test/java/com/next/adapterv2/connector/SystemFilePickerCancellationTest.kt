package com.next.adapterv2.connector

import com.next.adapterv2.interfaces.ConnectorCodes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class SystemFilePickerCancellationTest {
  @Test
  fun createsCanceledResponseForSystemPickerCancellation() {
    val response = createCanceledConnectorResponse(startedAt = 100L, timestamp = 160L)

    assertFalse(response.success)
    assertEquals(ConnectorCodes.CANCELED, response.code)
    assertEquals("CANCELED", response.message)
    assertEquals(60L, response.duration)
  }
}
