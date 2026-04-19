package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.mixcretailassemblyrn84.HotUpdateBootMarkerStore
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipFile

@ReactModule(name = HotUpdateTurboModule.NAME)
class HotUpdateTurboModule(reactContext: ReactApplicationContext) :
  NativeHotUpdateTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "HotUpdateTurboModule"
  }

  override fun getName(): String = NAME

  override fun downloadPackage(
    packageId: String,
    releaseId: String,
    bundleVersion: String,
    packageUrlsJson: String,
    packageSha256: String,
    manifestSha256: String,
    packageSize: Double,
    promise: Promise
  ) {
    runCatching {
      val root = File(reactApplicationContext.filesDir, "hot-updates/packages/$packageId")
      val staging = File(reactApplicationContext.cacheDir, "hot-updates/staging/$packageId")
      staging.deleteRecursively()
      staging.mkdirs()
      root.parentFile?.mkdirs()

      val archive = File(staging, "$packageId.zip")
      val packageUrls = JSONArray(packageUrlsJson)
      require(packageUrls.length() > 0) { "HOT_UPDATE_PACKAGE_URLS_EMPTY" }

      var downloadError: Throwable? = null
      for (index in 0 until packageUrls.length()) {
        val packageUrl = packageUrls.optString(index)
        if (packageUrl.isBlank()) {
          continue
        }
        try {
          URL(packageUrl).openStream().use { input ->
            archive.outputStream().use { output -> input.copyTo(output) }
          }
          downloadError = null
          break
        } catch (error: Throwable) {
          downloadError = error
        }
      }
      if (downloadError != null || !archive.exists()) {
        throw downloadError ?: error("HOT_UPDATE_DOWNLOAD_FAILED")
      }

      val actualPackageSha = sha256(archive)
      check(actualPackageSha.equals(packageSha256, ignoreCase = true)) { "HOT_UPDATE_PACKAGE_HASH_MISMATCH" }
      if (packageSize > 0) {
        check(archive.length() == packageSize.toLong()) { "HOT_UPDATE_PACKAGE_SIZE_MISMATCH" }
      }

      ZipFile(archive).use { zip ->
        val manifestEntry = zip.getEntry("manifest/hot-update-manifest.json")
          ?: error("HOT_UPDATE_MANIFEST_NOT_FOUND")
        val manifestFile = File(staging, "manifest.json")
        zip.getInputStream(manifestEntry).use { input ->
          manifestFile.outputStream().use { output -> input.copyTo(output) }
        }
        check(sha256(manifestFile).equals(manifestSha256, ignoreCase = true)) { "HOT_UPDATE_MANIFEST_HASH_MISMATCH" }

        val manifest = JSONObject(manifestFile.readText(Charsets.UTF_8))
        val packageObject = manifest.getJSONObject("package")
        val entryName = packageObject.getString("entry")
        val entry = zip.getEntry(entryName) ?: error("HOT_UPDATE_ENTRY_NOT_FOUND")
        val entryFile = File(staging, "index.android.bundle")
        zip.getInputStream(entry).use { input ->
          entryFile.outputStream().use { output -> input.copyTo(output) }
        }
        val expectedEntrySha = packageObject.getString("sha256")
        check(sha256(entryFile).equals(expectedEntrySha, ignoreCase = true)) { "HOT_UPDATE_ENTRY_HASH_MISMATCH" }

        root.deleteRecursively()
        check(staging.renameTo(root)) { "HOT_UPDATE_PROMOTE_FAILED" }

        Arguments.createMap().apply {
          putString("installDir", root.absolutePath)
          putString("entryFile", "index.android.bundle")
          putString("manifestPath", File(root, "manifest.json").absolutePath)
          putString("packageSha256", actualPackageSha)
          putString("manifestSha256", manifestSha256)
        }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun writeBootMarker(
    releaseId: String,
    packageId: String,
    bundleVersion: String,
    installDir: String,
    entryFile: String?,
    manifestSha256: String,
    maxLaunchFailures: Double,
    promise: Promise
  ) {
    runCatching {
      val marker = JSONObject()
        .put("releaseId", releaseId)
        .put("packageId", packageId)
        .put("bundleVersion", bundleVersion)
        .put("installDir", installDir)
        .put("entryFile", entryFile ?: "index.android.bundle")
        .put("manifestSha256", manifestSha256)
        .put("bootAttempt", 0)
        .put("maxLaunchFailures", maxLaunchFailures.toInt())
        .put("updatedAt", System.currentTimeMillis())
      val store = HotUpdateBootMarkerStore(reactApplicationContext.applicationContext)
      val file = store.writeActive(marker)
      Arguments.createMap().apply {
        putString("bootMarkerPath", file.absolutePath)
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun readActiveMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readActive()?.let { marker ->
        Arguments.createMap().apply {
          marker.keys().forEach { key ->
            putString(key, marker.opt(key)?.toString())
          }
        }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun readBootMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readBoot()?.let { marker ->
        Arguments.createMap().apply {
          marker.keys().forEach { key ->
            putString(key, marker.opt(key)?.toString())
          }
        }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun readRollbackMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readRollback()?.let { marker ->
        Arguments.createMap().apply {
          marker.keys().forEach { key ->
            putString(key, marker.opt(key)?.toString())
          }
        }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun clearBootMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).clearBoot()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun confirmLoadComplete(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).confirmLoadComplete()?.let { marker ->
        Arguments.createMap().apply {
          marker.keys().forEach { key ->
            putString(key, marker.opt(key)?.toString())
          }
        }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}
