package com.impos2.mixcretailassemblyrn84

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

class HotUpdateBootMarkerStore(private val context: Context) {

  private val rootDir: File
    get() = File(context.filesDir, "hot-updates")

  private val lockFile: File
    get() = File(rootDir, "marker.lock")

  private val activeFile: File
    get() = File(rootDir, "active-marker.json")

  private val bootFile: File
    get() = File(rootDir, "boot-marker.json")

  private val rollbackFile: File
    get() = File(rootDir, "rollback-marker.json")

  private inline fun <T> withMarkerLock(block: () -> T): T {
    rootDir.mkdirs()
    RandomAccessFile(lockFile, "rw").channel.use { channel ->
      channel.lock().use {
        return block()
      }
    }
  }

  private fun writeFileUnlocked(file: File, marker: JSONObject): File {
    file.parentFile?.mkdirs()
    val tmp = File(file.parentFile, "${file.name}.tmp")
    FileOutputStream(tmp).use { output ->
      output.write(marker.toString().toByteArray(Charsets.UTF_8))
      output.fd.sync()
    }
    if (!tmp.renameTo(file)) {
      tmp.copyTo(file, overwrite = true)
      tmp.delete()
    }
    return file
  }

  fun writeActive(marker: JSONObject): File = withMarkerLock {
    writeFileUnlocked(activeFile, marker)
  }

  fun writeBoot(marker: JSONObject): File = withMarkerLock {
    writeFileUnlocked(bootFile, marker)
  }

  private fun readFileUnlocked(file: File): JSONObject? {
    if (!file.exists()) return null
    return runCatching { JSONObject(file.readText(Charsets.UTF_8)) }.getOrNull()
  }

  fun readActive(): JSONObject? = withMarkerLock {
    readFileUnlocked(activeFile)
  }

  fun readBoot(): JSONObject? = withMarkerLock {
    readFileUnlocked(bootFile)
  }

  fun readRollback(): JSONObject? = withMarkerLock {
    readFileUnlocked(rollbackFile)
  }

  private fun clearActiveUnlocked() {
    activeFile.delete()
  }

  private fun clearBootUnlocked() {
    bootFile.delete()
  }

  private fun clearRollbackUnlocked() {
    rollbackFile.delete()
  }

  fun clearActive() = withMarkerLock {
    clearActiveUnlocked()
  }

  fun clearBoot() = withMarkerLock {
    clearBootUnlocked()
  }

  fun clearAll() = withMarkerLock {
    clearBootUnlocked()
    clearActiveUnlocked()
    clearRollbackUnlocked()
  }

  fun preparePrimaryBoot(defaultMaxLaunchFailures: Int): JSONObject? = withMarkerLock {
    val active = readFileUnlocked(activeFile) ?: return@withMarkerLock null
    val maxLaunchFailures = active.optInt("maxLaunchFailures", defaultMaxLaunchFailures)
      .coerceAtLeast(1)
    val nextBootAttempt = active.optInt("bootAttempt", 0) + 1
    if (nextBootAttempt > maxLaunchFailures) {
      writeRollbackUnlocked(
        active,
        "HOT_UPDATE_MAX_LAUNCH_FAILURES",
        active.optInt("bootAttempt", 0),
        maxLaunchFailures,
      )
      clearActiveUnlocked()
      clearBootUnlocked()
      return@withMarkerLock null
    }

    val updated = JSONObject(active.toString())
      .put("bootAttempt", nextBootAttempt)
      .put("lastBootAt", System.currentTimeMillis())
      .put("maxLaunchFailures", maxLaunchFailures)
    updated.remove("rollbackReason")
    updated.remove("rolledBackAt")
    writeFileUnlocked(activeFile, updated)
    writeFileUnlocked(bootFile, updated)
    clearRollbackUnlocked()
    updated
  }

  fun rollbackActive(reason: String): JSONObject? = withMarkerLock {
    val active = readFileUnlocked(activeFile) ?: readFileUnlocked(bootFile) ?: return@withMarkerLock null
    val maxLaunchFailures = active.optInt("maxLaunchFailures", 1).coerceAtLeast(1)
    val rollback = writeRollbackUnlocked(
      active,
      reason,
      active.optInt("bootAttempt", 0),
      maxLaunchFailures,
    )
    clearActiveUnlocked()
    clearBootUnlocked()
    rollback
  }

  fun confirmLoadComplete(): JSONObject? = withMarkerLock {
    val boot = readFileUnlocked(bootFile)
    if (boot != null) {
      val active = readFileUnlocked(activeFile) ?: boot
      val updated = JSONObject(active.toString())
        .put("bootAttempt", 0)
        .put("lastSuccessfulBootAt", System.currentTimeMillis())
      updated.remove("rollbackReason")
      updated.remove("rolledBackAt")
      writeFileUnlocked(activeFile, updated)
      clearBootUnlocked()
      clearRollbackUnlocked()
      return@withMarkerLock updated
    }

    val rollback = readFileUnlocked(rollbackFile)
    if (rollback != null) {
      clearRollbackUnlocked()
    }
    rollback
  }

  private fun writeRollbackUnlocked(
    source: JSONObject,
    reason: String,
    failedBootAttempt: Int,
    maxLaunchFailures: Int,
  ): JSONObject {
    val rollback = JSONObject(source.toString())
      .put("rollbackReason", reason)
      .put("failedBootAttempt", failedBootAttempt)
      .put("maxLaunchFailures", maxLaunchFailures)
      .put("rolledBackAt", System.currentTimeMillis())
    writeFileUnlocked(rollbackFile, rollback)
    return rollback
  }

  fun markerPath(): String = bootFile.absolutePath
}
