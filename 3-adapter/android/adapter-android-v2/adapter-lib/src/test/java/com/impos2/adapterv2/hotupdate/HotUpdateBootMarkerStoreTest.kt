package com.impos2.adapterv2.hotupdate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
