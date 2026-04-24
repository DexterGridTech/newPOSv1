package com.next.adapterv2.hotupdate

import android.content.Context
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipFile
import org.json.JSONObject

data class HotUpdatePackageRequest(
  val packageId: String,
  val packageUrls: List<String>,
  val packageSha256: String,
  val manifestSha256: String,
  val packageSize: Long,
  val maxRetainedPackages: Int = 2,
)

data class HotUpdatePackageInstallResult(
  val installDir: File,
  val entryFile: String,
  val manifestPath: File,
  val packageSha256: String,
  val manifestSha256: String,
)

data class HotUpdateManifestPackage(
  val entry: String,
  val sha256: String,
)

class HotUpdatePackageInstaller(
  private val packagesRootDir: File,
  private val stagingRootDir: File,
  private val connectTimeoutMs: Int = 15_000,
  private val readTimeoutMs: Int = 60_000,
) {

  constructor(context: Context) : this(
    packagesRootDir = File(context.filesDir, "hot-updates/packages"),
    stagingRootDir = File(context.cacheDir, "hot-updates/staging"),
  )

  fun downloadPackage(
    input: HotUpdatePackageRequest,
    isCancelled: () -> Boolean = { false },
  ): HotUpdatePackageInstallResult {
    require(input.packageUrls.isNotEmpty()) { "HOT_UPDATE_PACKAGE_URLS_EMPTY" }
    ensureNotCancelled(isCancelled)

    val installDir = File(packagesRootDir, input.packageId)
    val stagingDir = File(stagingRootDir, input.packageId)
    stagingDir.deleteRecursively()
    stagingDir.mkdirs()
    installDir.parentFile?.mkdirs()

    try {
      val archive = File(stagingDir, "${input.packageId}.zip")
      downloadArchive(input.packageUrls, archive, isCancelled)

      val actualPackageSha = sha256(archive)
      check(actualPackageSha.equals(input.packageSha256, ignoreCase = true)) {
        "HOT_UPDATE_PACKAGE_HASH_MISMATCH"
      }
      if (input.packageSize > 0) {
        check(archive.length() == input.packageSize) { "HOT_UPDATE_PACKAGE_SIZE_MISMATCH" }
      }

      ZipFile(archive).use { zip ->
        val manifestEntry = zip.getEntry("manifest/hot-update-manifest.json")
          ?: error("HOT_UPDATE_MANIFEST_NOT_FOUND")
        val manifestFile = File(stagingDir, "manifest.json")
        zip.getInputStream(manifestEntry).use { inputStream ->
          manifestFile.outputStream().use { output -> copyToWithCancellation(inputStream, output, isCancelled) }
        }
        check(sha256(manifestFile).equals(input.manifestSha256, ignoreCase = true)) {
          "HOT_UPDATE_MANIFEST_HASH_MISMATCH"
        }

        val manifestPackage = HotUpdateManifestCodec.decodePackage(
          manifestFile.readText(Charsets.UTF_8),
        ) ?: error("HOT_UPDATE_MANIFEST_INVALID")
        val entryName = manifestPackage.entry
        val entry = zip.getEntry(entryName) ?: error("HOT_UPDATE_ENTRY_NOT_FOUND")
        val entryFile = File(stagingDir, "index.android.bundle")
        zip.getInputStream(entry).use { inputStream ->
          entryFile.outputStream().use { output -> copyToWithCancellation(inputStream, output, isCancelled) }
        }
        val expectedEntrySha = manifestPackage.sha256
        check(sha256(entryFile).equals(expectedEntrySha, ignoreCase = true)) {
          "HOT_UPDATE_ENTRY_HASH_MISMATCH"
        }

        installDir.deleteRecursively()
        check(stagingDir.renameTo(installDir)) { "HOT_UPDATE_PROMOTE_FAILED" }
        pruneRetainedPackages(input.packageId, input.maxRetainedPackages)

        return HotUpdatePackageInstallResult(
          installDir = installDir,
          entryFile = "index.android.bundle",
          manifestPath = File(installDir, "manifest.json"),
          packageSha256 = actualPackageSha,
          manifestSha256 = input.manifestSha256,
        )
      }
    } catch (error: Throwable) {
      stagingDir.deleteRecursively()
      throw error
    }
  }

  private fun pruneRetainedPackages(currentPackageId: String, maxRetainedPackages: Int) {
    val retainCount = maxRetainedPackages.coerceAtLeast(1)
    val packageDirs = packagesRootDir.listFiles()
      ?.filter { it.isDirectory }
      ?.sortedByDescending { it.lastModified() }
      ?: return
    packageDirs
      .filter { it.name != currentPackageId }
      .drop((retainCount - 1).coerceAtLeast(0))
      .forEach { it.deleteRecursively() }
  }

  private fun downloadArchive(
    packageUrls: List<String>,
    archive: File,
    isCancelled: () -> Boolean,
  ) {
    var downloadError: Throwable? = null

    for (packageUrl in packageUrls) {
      ensureNotCancelled(isCancelled)
      if (packageUrl.isBlank()) {
        continue
      }
      try {
        val connection = URL(packageUrl).openConnection()
        connection.connectTimeout = connectTimeoutMs
        connection.readTimeout = readTimeoutMs
        if (connection is HttpURLConnection) {
          connection.instanceFollowRedirects = true
          connection.requestMethod = "GET"
          val code = connection.responseCode
          check(code in 200..299) { "HOT_UPDATE_DOWNLOAD_HTTP_$code" }
          connection.inputStream.use { input ->
            archive.outputStream().use { output ->
              copyToWithCancellation(input, output, isCancelled)
            }
          }
          connection.disconnect()
        } else {
          connection.getInputStream().use { input ->
            archive.outputStream().use { output ->
              copyToWithCancellation(input, output, isCancelled)
            }
          }
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
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) {
          break
        }
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun copyToWithCancellation(
    input: InputStream,
    output: OutputStream,
    isCancelled: () -> Boolean,
  ) {
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    while (true) {
      ensureNotCancelled(isCancelled)
      val read = input.read(buffer)
      if (read <= 0) {
        break
      }
      output.write(buffer, 0, read)
    }
    output.flush()
  }

  private fun ensureNotCancelled(isCancelled: () -> Boolean) {
    check(!isCancelled()) { "HOT_UPDATE_DOWNLOAD_CANCELLED" }
  }
}

object HotUpdateManifestCodec {
  fun decodePackage(input: String): HotUpdateManifestPackage? {
    return runCatching {
      val packageBody = JSONObject(input).optJSONObject("package") ?: return null
      val entry = packageBody.optString("entry").takeIf { it.isNotBlank() } ?: return null
      val sha256 = packageBody.optString("sha256").takeIf { it.isNotBlank() } ?: return null
      HotUpdateManifestPackage(
        entry = entry,
        sha256 = sha256,
      )
    }.getOrNull()
  }
}
