package com.next.mixccateringassemblyrn84.restart

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppRestartManagerTest {
  @Test
  fun `normalize hot update bundle file keeps non blank bundle path`() {
    val bundleFile = AppRestartManager.normalizeHotUpdateBundleFile("/data/user/0/app/files/hot-updates/packages/pkg-1/index.android.bundle")

    assertEquals(
      "/data/user/0/app/files/hot-updates/packages/pkg-1/index.android.bundle",
      bundleFile,
    )
  }

  @Test
  fun `normalize hot update bundle file returns null for blank value`() {
    val bundleFile = AppRestartManager.normalizeHotUpdateBundleFile("   ")

    assertNull(bundleFile)
  }

  @Test
  fun `normalize hot update bundle file returns null for missing value`() {
    assertNull(AppRestartManager.normalizeHotUpdateBundleFile(null))
  }

  @Test
  fun `hot update restart relaunches process only when bundle path is available`() {
    assertTrue(AppRestartManager.shouldRelaunchProcessForHotUpdate("/data/user/0/app/files/hot-updates/packages/pkg-1/index.android.bundle"))
  }

  @Test
  fun `manual restart does not relaunch process when hot update bundle is missing`() {
    assertTrue(!AppRestartManager.shouldRelaunchProcessForHotUpdate(null))
    assertTrue(!AppRestartManager.shouldRelaunchProcessForHotUpdate(" "))
  }
}
