package com.impos2.mixcretailassemblyrn84

import android.content.Context
import java.io.File

class HotUpdateBundleResolver(private val context: Context) {

  private val store = HotUpdateBootMarkerStore(context)

  fun resolveBundleFile(isPrimaryProcess: Boolean = true): String? {
    val marker = if (isPrimaryProcess) {
      store.preparePrimaryBoot(1)
    } else {
      store.readActive()
    } ?: return null
    val installDir = marker.optString("installDir")
    val entryFile = marker.optString("entryFile")
    if (installDir.isBlank()) return null
    val bundleFile = if (entryFile.isBlank()) {
      File(installDir, "index.android.bundle")
    } else {
      File(installDir, entryFile)
    }
    if (!bundleFile.exists()) {
      if (isPrimaryProcess) {
        store.rollbackActive("HOT_UPDATE_BUNDLE_MISSING")
      }
      return null
    }
    return bundleFile.absolutePath
  }
}
