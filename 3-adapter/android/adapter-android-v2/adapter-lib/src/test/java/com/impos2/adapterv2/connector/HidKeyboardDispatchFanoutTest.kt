package com.impos2.adapterv2.connector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HidKeyboardDispatchFanoutTest {
  @Test
  fun duplicatesBufferedTextForEverySubscription() {
    val first = ConnectorManager.HidSubscriptionSnapshot(channelId = "first", target = "keyboard")
    val second = ConnectorManager.HidSubscriptionSnapshot(channelId = "second", target = "keyboard")

    appendBufferedCharForSubscriptions(listOf(first, second), 'A')

    val events = flushBufferedSubscriptions(listOf(first, second))

    assertEquals(2, events.size)
    assertEquals(setOf("first", "second"), events.map { it.channelId }.toSet())
    assertTrue(events.all { it.raw == "A" })
    assertTrue(events.all { it.data?.get("text") == "A" })
  }
}
