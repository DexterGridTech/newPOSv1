package com.impos2.adapterv2.hotupdate

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

data class HotUpdateMarker(
  val releaseId: String,
  val packageId: String,
  val bundleVersion: String,
  val installDir: String,
  val entryFile: String = "index.android.bundle",
  val manifestSha256: String,
  val bootAttempt: Int = 0,
  val maxLaunchFailures: Int = 1,
  val healthCheckTimeoutMs: Long = HotUpdateBootMarkerStore.DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
  val updatedAt: Long = System.currentTimeMillis(),
  val lastBootAt: Long? = null,
  val lastSuccessfulBootAt: Long? = null,
  val rollbackReason: String? = null,
  val failedBootAttempt: Int? = null,
  val rolledBackAt: Long? = null,
)

class HotUpdateBootMarkerStore(private val rootDir: File) {
  companion object {
    const val DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 30_000L
  }

  constructor(context: Context) : this(File(context.filesDir, "hot-updates"))

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

  fun writeActive(marker: HotUpdateMarker): File = withMarkerLock {
    writeFileUnlocked(activeFile, marker)
  }

  fun writeBoot(marker: HotUpdateMarker): File = withMarkerLock {
    writeFileUnlocked(bootFile, marker)
  }

  fun readActive(): HotUpdateMarker? = withMarkerLock {
    readFileUnlocked(activeFile)
  }

  fun readBoot(): HotUpdateMarker? = withMarkerLock {
    readFileUnlocked(bootFile)
  }

  fun readRollback(): HotUpdateMarker? = withMarkerLock {
    readFileUnlocked(rollbackFile)
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

  fun preparePrimaryBoot(defaultMaxLaunchFailures: Int): HotUpdateMarker? = withMarkerLock {
    val active = readFileUnlocked(activeFile) ?: return@withMarkerLock null
    val maxLaunchFailures = active.maxLaunchFailures.coerceAtLeast(defaultMaxLaunchFailures).coerceAtLeast(1)
    val nextBootAttempt = active.bootAttempt + 1
    if (nextBootAttempt > maxLaunchFailures) {
      writeRollbackUnlocked(
        source = active,
        reason = "HOT_UPDATE_MAX_LAUNCH_FAILURES",
        failedBootAttempt = active.bootAttempt,
        maxLaunchFailures = maxLaunchFailures,
      )
      clearActiveUnlocked()
      clearBootUnlocked()
      return@withMarkerLock null
    }

    val updated = active.copy(
      bootAttempt = nextBootAttempt,
      maxLaunchFailures = maxLaunchFailures,
      lastBootAt = System.currentTimeMillis(),
      rollbackReason = null,
      failedBootAttempt = null,
      rolledBackAt = null,
    )
    writeFileUnlocked(activeFile, updated)
    writeFileUnlocked(bootFile, updated)
    clearRollbackUnlocked()
    updated
  }

  fun rollbackActive(reason: String): HotUpdateMarker? = withMarkerLock {
    val active = readFileUnlocked(activeFile) ?: readFileUnlocked(bootFile) ?: return@withMarkerLock null
    val maxLaunchFailures = active.maxLaunchFailures.coerceAtLeast(1)
    val rollback = writeRollbackUnlocked(
      source = active,
      reason = reason,
      failedBootAttempt = active.bootAttempt,
      maxLaunchFailures = maxLaunchFailures,
    )
    clearActiveUnlocked()
    clearBootUnlocked()
    rollback
  }

  fun confirmLoadComplete(): HotUpdateMarker? = withMarkerLock {
    val boot = readFileUnlocked(bootFile)
    if (boot != null) {
      val active = readFileUnlocked(activeFile) ?: boot
      val updated = active.copy(
        bootAttempt = 0,
        lastSuccessfulBootAt = System.currentTimeMillis(),
        rollbackReason = null,
        failedBootAttempt = null,
        rolledBackAt = null,
      )
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

  fun markerPath(): String = bootFile.absolutePath

  private fun writeFileUnlocked(file: File, marker: HotUpdateMarker): File {
    file.parentFile?.mkdirs()
    val tmp = File(file.parentFile, "${file.name}.tmp")
    FileOutputStream(tmp).use { output ->
      output.write(HotUpdateMarkerCodec.encode(marker).toByteArray(Charsets.UTF_8))
      output.fd.sync()
    }
    if (!tmp.renameTo(file)) {
      tmp.copyTo(file, overwrite = true)
      tmp.delete()
    }
    return file
  }

  private fun readFileUnlocked(file: File): HotUpdateMarker? {
    if (!file.exists()) {
      return null
    }
    return HotUpdateMarkerCodec.decode(file.readText(Charsets.UTF_8))
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

  private fun writeRollbackUnlocked(
    source: HotUpdateMarker,
    reason: String,
    failedBootAttempt: Int,
    maxLaunchFailures: Int,
  ): HotUpdateMarker {
    val rollback = source.copy(
      rollbackReason = reason,
      failedBootAttempt = failedBootAttempt,
      maxLaunchFailures = maxLaunchFailures,
      rolledBackAt = System.currentTimeMillis(),
    )
    writeFileUnlocked(rollbackFile, rollback)
    return rollback
  }
}

object HotUpdateMarkerCodec {
  fun encode(marker: HotUpdateMarker): String {
    return buildString {
      append("{")
      appendJsonField("releaseId", marker.releaseId, first = true)
      appendJsonField("packageId", marker.packageId)
      appendJsonField("bundleVersion", marker.bundleVersion)
      appendJsonField("installDir", marker.installDir)
      appendJsonField("entryFile", marker.entryFile)
      appendJsonField("manifestSha256", marker.manifestSha256)
      appendJsonNumberField("bootAttempt", marker.bootAttempt)
      appendJsonNumberField("maxLaunchFailures", marker.maxLaunchFailures)
      appendJsonNumberField("healthCheckTimeoutMs", marker.healthCheckTimeoutMs)
      appendJsonNumberField("updatedAt", marker.updatedAt)
      appendJsonOptionalNumberField("lastBootAt", marker.lastBootAt)
      appendJsonOptionalNumberField("lastSuccessfulBootAt", marker.lastSuccessfulBootAt)
      appendJsonOptionalField("rollbackReason", marker.rollbackReason)
      appendJsonOptionalNumberField("failedBootAttempt", marker.failedBootAttempt?.toLong())
      appendJsonOptionalNumberField("rolledBackAt", marker.rolledBackAt)
      append("}")
    }
  }

  fun decode(input: String): HotUpdateMarker? {
    return runCatching {
      HotUpdateMarker(
        releaseId = requireString(input, "releaseId"),
        packageId = requireString(input, "packageId"),
        bundleVersion = requireString(input, "bundleVersion"),
        installDir = requireString(input, "installDir"),
        entryFile = findString(input, "entryFile") ?: "index.android.bundle",
        manifestSha256 = requireString(input, "manifestSha256"),
        bootAttempt = findInt(input, "bootAttempt") ?: 0,
        maxLaunchFailures = findInt(input, "maxLaunchFailures") ?: 1,
        healthCheckTimeoutMs = findLong(input, "healthCheckTimeoutMs")
          ?: HotUpdateBootMarkerStore.DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
        updatedAt = findLong(input, "updatedAt") ?: 0L,
        lastBootAt = findLong(input, "lastBootAt"),
        lastSuccessfulBootAt = findLong(input, "lastSuccessfulBootAt"),
        rollbackReason = findString(input, "rollbackReason"),
        failedBootAttempt = findInt(input, "failedBootAttempt"),
        rolledBackAt = findLong(input, "rolledBackAt"),
      )
    }.getOrNull()
  }

  private fun StringBuilder.appendJsonField(key: String, value: String, first: Boolean = false) {
    if (!first) {
      append(",")
    }
    append("\"")
    append(key)
    append("\":\"")
    append(escapeJson(value))
    append("\"")
  }

  private fun StringBuilder.appendJsonOptionalField(key: String, value: String?) {
    if (value == null) {
      return
    }
    appendJsonField(key, value)
  }

  private fun StringBuilder.appendJsonNumberField(key: String, value: Number) {
    append(",\"")
    append(key)
    append("\":")
    append(value)
  }

  private fun StringBuilder.appendJsonOptionalNumberField(key: String, value: Long?) {
    if (value == null) {
      return
    }
    appendJsonNumberField(key, value)
  }

  private fun requireString(input: String, key: String): String {
    return findString(input, key) ?: error("Missing $key")
  }

  internal fun findString(input: String, key: String): String? {
    val regex = Regex("""\"$key\"\s*:\s*\"((?:\\.|[^\"\\])*)\"""")
    val match = regex.find(input) ?: return null
    return unescapeJson(match.groupValues[1])
  }

  private fun findInt(input: String, key: String): Int? = findLong(input, key)?.toInt()

  private fun findLong(input: String, key: String): Long? {
    val regex = Regex("""\"$key\"\s*:\s*(-?\d+)""")
    val match = regex.find(input) ?: return null
    return match.groupValues[1].toLongOrNull()
  }

  private fun escapeJson(value: String): String {
    val builder = StringBuilder()
    value.forEach { ch ->
      when (ch) {
        '\\' -> builder.append("\\\\")
        '"' -> builder.append("\\\"")
        '\n' -> builder.append("\\n")
        '\r' -> builder.append("\\r")
        '\t' -> builder.append("\\t")
        else -> builder.append(ch)
      }
    }
    return builder.toString()
  }

  internal fun unescapeJson(value: String): String {
    val result = StringBuilder()
    var index = 0
    while (index < value.length) {
      val ch = value[index]
      if (ch != '\\') {
        result.append(ch)
        index += 1
        continue
      }
      check(index + 1 < value.length) { "Invalid escape sequence" }
      when (val escaped = value[index + 1]) {
        '\\' -> result.append('\\')
        '"' -> result.append('"')
        'n' -> result.append('\n')
        'r' -> result.append('\r')
        't' -> result.append('\t')
        'u' -> {
          check(index + 5 < value.length) { "Invalid unicode escape" }
          val codePoint = value.substring(index + 2, index + 6).toInt(16)
          result.append(codePoint.toChar())
          index += 4
        }
        else -> result.append(escaped)
      }
      index += 2
    }
    return result.toString()
  }
}
