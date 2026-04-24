package com.next.hostruntimern84

import android.content.Context
import android.os.Process
import android.util.Log
import com.next.adapterv2.hotupdate.HotUpdateBootMarkerStore
import com.next.adapterv2.hotupdate.HotUpdateMarker
import java.io.File

class HotUpdateBundleResolver(private val context: Context) {
  companion object {
    private const val TAG = "HotUpdateBundleResolver"
    private const val DEFAULT_PRIMARY_MAX_LAUNCH_FAILURES = 1
  }

  private val store = HotUpdateBootMarkerStore(context)

  fun resolveBundleFile(isPrimaryProcess: Boolean = true): String? {
    val marker = if (isPrimaryProcess) {
      store.preparePrimaryBoot(DEFAULT_PRIMARY_MAX_LAUNCH_FAILURES)
    } else {
      store.readActive()
    } ?: run {
      Log.i(
        TAG,
        "no_active_marker isPrimaryProcess=$isPrimaryProcess pid=${Process.myPid()}",
      )
      return null
    }

    return resolveMarkerBundleFile(
      marker = marker,
      rollbackIfMissing = isPrimaryProcess,
      missingReason = "HOT_UPDATE_BUNDLE_MISSING",
      source = if (isPrimaryProcess) "primary-boot" else "secondary-boot",
    )
  }

  /**
   * Reads the currently active hot-update bundle without consuming a primary boot attempt.
   *
   * AppRestartManager uses this before a process relaunch. The new process will call
   * [resolveBundleFile] and record the actual boot attempt once, so peeking here must be side
   * effect free.
   */
  fun peekActiveBundleFile(): String? {
    val marker = store.readActive() ?: run {
      Log.i(TAG, "peek_active_marker_miss pid=${Process.myPid()}")
      return null
    }
    return resolveMarkerBundleFile(
      marker = marker,
      rollbackIfMissing = false,
      missingReason = "HOT_UPDATE_BUNDLE_MISSING_ON_RESTART",
      source = "restart-peek",
    )
  }

  private fun resolveMarkerBundleFile(
    marker: HotUpdateMarker,
    rollbackIfMissing: Boolean,
    missingReason: String,
    source: String,
  ): String? {
    val installDir = marker.installDir
    val entryFile = marker.entryFile
    if (installDir.isBlank()) {
      Log.w(
        TAG,
        "marker_install_dir_blank source=$source bundleVersion=${marker.bundleVersion} packageId=${marker.packageId} pid=${Process.myPid()}",
      )
      return null
    }
    val bundleFile = if (entryFile.isBlank()) {
      File(installDir, "index.android.bundle")
    } else {
      File(installDir, entryFile)
    }
    if (!bundleFile.exists()) {
      Log.w(
        TAG,
        "bundle_missing source=$source bundleFile=${bundleFile.absolutePath} bundleVersion=${marker.bundleVersion} packageId=${marker.packageId} rollback=$rollbackIfMissing pid=${Process.myPid()}",
      )
      if (rollbackIfMissing) {
        store.rollbackActive(missingReason)
      }
      return null
    }
    Log.i(
      TAG,
      "bundle_resolved source=$source bundleFile=${bundleFile.absolutePath} bundleVersion=${marker.bundleVersion} packageId=${marker.packageId} bootAttempt=${marker.bootAttempt} pid=${Process.myPid()}",
    )
    return bundleFile.absolutePath
  }
}
