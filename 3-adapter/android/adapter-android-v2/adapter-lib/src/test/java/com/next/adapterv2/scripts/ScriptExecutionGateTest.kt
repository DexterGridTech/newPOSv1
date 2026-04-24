package com.next.adapterv2.scripts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ScriptExecutionGateTest {
  @Test
  fun serializesConcurrentCallers() {
    val gate = ScriptExecutionGate()
    val pool = Executors.newFixedThreadPool(2)
    val firstEntered = CountDownLatch(1)
    val releaseFirst = CountDownLatch(1)
    val secondAttempting = CountDownLatch(1)
    val secondEntered = CountDownLatch(1)

    try {
      val first = pool.submit<String> {
        gate.runExclusive {
          firstEntered.countDown()
          assertTrue(releaseFirst.await(2, TimeUnit.SECONDS))
          "first"
        }
      }

      assertTrue(firstEntered.await(2, TimeUnit.SECONDS))

      val second = pool.submit<String> {
        secondAttempting.countDown()
        gate.runExclusive {
          secondEntered.countDown()
          "second"
        }
      }

      assertTrue(secondAttempting.await(2, TimeUnit.SECONDS))
      assertFalse(secondEntered.await(100, TimeUnit.MILLISECONDS))

      releaseFirst.countDown()

      assertEquals("first", first.get(2, TimeUnit.SECONDS))
      assertEquals("second", second.get(2, TimeUnit.SECONDS))
      assertTrue(secondEntered.await(2, TimeUnit.SECONDS))
    } finally {
      pool.shutdownNow()
    }
  }
}
