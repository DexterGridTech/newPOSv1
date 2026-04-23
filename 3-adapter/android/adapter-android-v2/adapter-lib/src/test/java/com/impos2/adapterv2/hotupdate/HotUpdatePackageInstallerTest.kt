package com.impos2.adapterv2.hotupdate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class HotUpdatePackageInstallerTest {
  @Test
  fun downloadsFromFallbackUrlAndPromotesNormalizedBundle() {
    val packagesRootDir = Files.createTempDirectory("hot-update-packages").toFile()
    val stagingRootDir = Files.createTempDirectory("hot-update-staging").toFile()
    val archiveRootDir = Files.createTempDirectory("hot-update-archive").toFile()

    try {
      val entryContent = "console.log('hot-update')"
      val manifestContent = """
        {
          "package": {
            "entry": "bundles/main.bundle",
            "sha256": "${sha256(entryContent.toByteArray(Charsets.UTF_8))}"
          }
        }
      """.trimIndent()
      val archive = File(archiveRootDir, "pkg-1.zip")
      writeZip(
        archive = archive,
        entries = mapOf(
          "manifest/hot-update-manifest.json" to manifestContent,
          "bundles/main.bundle" to entryContent,
        ),
      )

      val installer = HotUpdatePackageInstaller(
        packagesRootDir = packagesRootDir,
        stagingRootDir = stagingRootDir,
      )

      val result = installer.downloadPackage(
        HotUpdatePackageRequest(
          packageId = "pkg-1",
          packageUrls = listOf(
            File(archiveRootDir, "missing.zip").toURI().toURL().toString(),
            archive.toURI().toURL().toString(),
          ),
          packageSha256 = sha256(archive),
          manifestSha256 = sha256(manifestContent.toByteArray(Charsets.UTF_8)),
          packageSize = archive.length(),
        ),
      )

      assertEquals(File(packagesRootDir, "pkg-1").absolutePath, result.installDir.absolutePath)
      assertEquals("index.android.bundle", result.entryFile)
      assertTrue(File(result.installDir, "index.android.bundle").exists())
      assertTrue(File(result.installDir, "manifest.json").exists())
      assertFalse(File(stagingRootDir, "pkg-1").exists())
      assertEquals(sha256(archive), result.packageSha256)
    } finally {
      packagesRootDir.deleteRecursively()
      stagingRootDir.deleteRecursively()
      archiveRootDir.deleteRecursively()
    }
  }

  @Test
  fun rejectsManifestHashMismatchWithoutPromotingPackage() {
    val packagesRootDir = Files.createTempDirectory("hot-update-packages-bad").toFile()
    val stagingRootDir = Files.createTempDirectory("hot-update-staging-bad").toFile()
    val archiveRootDir = Files.createTempDirectory("hot-update-archive-bad").toFile()

    try {
      val entryContent = "console.log('bad-hot-update')"
      val manifestContent = """
        {
          "package": {
            "entry": "index.bundle",
            "sha256": "${sha256(entryContent.toByteArray(Charsets.UTF_8))}"
          }
        }
      """.trimIndent()
      val archive = File(archiveRootDir, "pkg-bad.zip")
      writeZip(
        archive = archive,
        entries = mapOf(
          "manifest/hot-update-manifest.json" to manifestContent,
          "index.bundle" to entryContent,
        ),
      )

      val installer = HotUpdatePackageInstaller(
        packagesRootDir = packagesRootDir,
        stagingRootDir = stagingRootDir,
      )

      try {
        installer.downloadPackage(
          HotUpdatePackageRequest(
            packageId = "pkg-bad",
            packageUrls = listOf(archive.toURI().toURL().toString()),
            packageSha256 = sha256(archive),
            manifestSha256 = "wrong-manifest-sha",
            packageSize = archive.length(),
          ),
        )
        fail("Expected manifest hash mismatch")
      } catch (error: IllegalStateException) {
        assertEquals("HOT_UPDATE_MANIFEST_HASH_MISMATCH", error.message)
      }

      assertFalse(File(packagesRootDir, "pkg-bad").exists())
      assertFalse(File(stagingRootDir, "pkg-bad").exists())
    } finally {
      packagesRootDir.deleteRecursively()
      stagingRootDir.deleteRecursively()
      archiveRootDir.deleteRecursively()
    }
  }

  @Test
  fun stopsDownloadWhenCancelledBeforeFetch() {
    val packagesRootDir = Files.createTempDirectory("hot-update-packages-cancel").toFile()
    val stagingRootDir = Files.createTempDirectory("hot-update-staging-cancel").toFile()
    val archiveRootDir = Files.createTempDirectory("hot-update-archive-cancel").toFile()

    try {
      val archive = File(archiveRootDir, "pkg-cancel.zip")
      writeZip(
        archive = archive,
        entries = mapOf(
          "manifest/hot-update-manifest.json" to """
            {
              "package": {
                "entry": "index.bundle",
                "sha256": "${sha256("bundle".toByteArray(Charsets.UTF_8))}"
              }
            }
          """.trimIndent(),
          "index.bundle" to "bundle",
        ),
      )

      val installer = HotUpdatePackageInstaller(
        packagesRootDir = packagesRootDir,
        stagingRootDir = stagingRootDir,
      )

      try {
        installer.downloadPackage(
          HotUpdatePackageRequest(
            packageId = "pkg-cancel",
            packageUrls = listOf(archive.toURI().toURL().toString()),
            packageSha256 = sha256(archive),
            manifestSha256 = "unused",
            packageSize = archive.length(),
          ),
          isCancelled = { true },
        )
        fail("Expected cancellation")
      } catch (error: IllegalStateException) {
        assertEquals("HOT_UPDATE_DOWNLOAD_CANCELLED", error.message)
      }
      assertFalse(File(stagingRootDir, "pkg-cancel").exists())
    } finally {
      packagesRootDir.deleteRecursively()
      stagingRootDir.deleteRecursively()
      archiveRootDir.deleteRecursively()
    }
  }

  @Test
  fun prunesOlderPackagesAfterSuccessfulPromotion() {
    val packagesRootDir = Files.createTempDirectory("hot-update-packages-prune").toFile()
    val stagingRootDir = Files.createTempDirectory("hot-update-staging-prune").toFile()
    val archiveRootDir = Files.createTempDirectory("hot-update-archive-prune").toFile()

    try {
      val installer = HotUpdatePackageInstaller(
        packagesRootDir = packagesRootDir,
        stagingRootDir = stagingRootDir,
      )

      installPackage(installer, archiveRootDir, "pkg-1", "console.log('one')", 2)
      Thread.sleep(2)
      installPackage(installer, archiveRootDir, "pkg-2", "console.log('two')", 2)
      Thread.sleep(2)
      installPackage(installer, archiveRootDir, "pkg-3", "console.log('three')", 2)

      assertFalse(File(packagesRootDir, "pkg-1").exists())
      assertTrue(File(packagesRootDir, "pkg-2").exists())
      assertTrue(File(packagesRootDir, "pkg-3").exists())
    } finally {
      packagesRootDir.deleteRecursively()
      stagingRootDir.deleteRecursively()
      archiveRootDir.deleteRecursively()
    }
  }

  private fun writeZip(archive: File, entries: Map<String, String>) {
    ZipOutputStream(archive.outputStream()).use { zip ->
      entries.forEach { (name, content) ->
        zip.putNextEntry(ZipEntry(name))
        zip.write(content.toByteArray(Charsets.UTF_8))
        zip.closeEntry()
      }
    }
  }

  private fun installPackage(
    installer: HotUpdatePackageInstaller,
    archiveRootDir: File,
    packageId: String,
    entryContent: String,
    maxRetainedPackages: Int,
  ) {
    val manifestContent = """
      {
        "package": {
          "entry": "index.bundle",
          "sha256": "${sha256(entryContent.toByteArray(Charsets.UTF_8))}"
        }
      }
    """.trimIndent()
    val archive = File(archiveRootDir, "$packageId.zip")
    writeZip(
      archive = archive,
      entries = mapOf(
        "manifest/hot-update-manifest.json" to manifestContent,
        "index.bundle" to entryContent,
      ),
    )

    installer.downloadPackage(
      HotUpdatePackageRequest(
        packageId = packageId,
        packageUrls = listOf(archive.toURI().toURL().toString()),
        packageSha256 = sha256(archive),
        manifestSha256 = sha256(manifestContent.toByteArray(Charsets.UTF_8)),
        packageSize = archive.length(),
        maxRetainedPackages = maxRetainedPackages,
      ),
    )
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

  private fun sha256(value: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(value)
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}
