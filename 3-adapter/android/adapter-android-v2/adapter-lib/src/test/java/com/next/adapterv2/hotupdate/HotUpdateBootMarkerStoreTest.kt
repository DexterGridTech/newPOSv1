package com.next.adapterv2.hotupdate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class HotUpdateBootMarkerStoreTest {
  @Test
  fun derivesBootMarkerFromActiveAndConfirmsStableBoot() {
    val rootDir = Files.createTempDirectory("hot-update-marker-store").toFile()

    try {
      val store = HotUpdateBootMarkerStore(rootDir)
      store.writeActive(
        createMarker().copy(
          bootAttempt = 0,
          maxLaunchFailures = 2,
        ),
      )

      val boot = store.preparePrimaryBoot(defaultMaxLaunchFailures = 1)

      assertNotNull(boot)
      assertEquals(1, boot?.bootAttempt)
      assertEquals(1, store.readBoot()?.bootAttempt)

      val confirmed = store.confirmLoadComplete()

      assertNotNull(confirmed)
      assertEquals(0, confirmed?.bootAttempt)
      assertNull(store.readBoot())
      assertEquals(0, store.readActive()?.bootAttempt)
    } finally {
      rootDir.deleteRecursively()
    }
  }

  @Test
  fun rollsBackWhenLaunchFailuresAreExceeded() {
    val rootDir = Files.createTempDirectory("hot-update-marker-store-rollback").toFile()

    try {
      val store = HotUpdateBootMarkerStore(rootDir)
      store.writeActive(
        createMarker().copy(
          bootAttempt = 1,
          maxLaunchFailures = 1,
        ),
      )

      val boot = store.preparePrimaryBoot(defaultMaxLaunchFailures = 1)

      assertNull(boot)
      assertNull(store.readActive())
      assertNull(store.readBoot())
      assertEquals(
        "HOT_UPDATE_MAX_LAUNCH_FAILURES",
        store.readRollback()?.rollbackReason,
      )
    } finally {
      rootDir.deleteRecursively()
    }
  }

  @Test
  fun persistsHealthCheckTimeoutAcrossCodecRoundTrip() {
    val marker = createMarker().copy(
      healthCheckTimeoutMs = 15_000L,
    )

    val encoded = HotUpdateMarkerCodec.encode(marker)
    val decoded = HotUpdateMarkerCodec.decode(encoded)

    assertNotNull(decoded)
    assertEquals(15_000L, decoded?.healthCheckTimeoutMs)
    assertTrue(encoded.contains("\"healthCheckTimeoutMs\":15000"))
  }

  @Test
  fun usesProductionSafeHealthCheckTimeoutWhenLegacyMarkerOmitsIt() {
    val decoded = HotUpdateMarkerCodec.decode(
      """
        {
          "releaseId":"rel-legacy",
          "packageId":"pkg-legacy",
          "bundleVersion":"1.0.0+ota.legacy",
          "installDir":"/tmp/pkg-legacy",
          "entryFile":"index.android.bundle",
          "manifestSha256":"manifest-sha",
          "bootAttempt":0,
          "maxLaunchFailures":2,
          "updatedAt":123
        }
      """.trimIndent(),
    )

    assertNotNull(decoded)
    assertEquals(
      HotUpdateBootMarkerStore.DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
      decoded?.healthCheckTimeoutMs,
    )
  }

  private fun createMarker(): HotUpdateMarker {
    return HotUpdateMarker(
      releaseId = "rel-1",
      packageId = "pkg-1",
      bundleVersion = "1.0.0+ota.1",
      installDir = "/tmp/pkg-1",
      entryFile = "index.android.bundle",
      manifestSha256 = "manifest-sha",
      updatedAt = 123L,
    )
  }
}
