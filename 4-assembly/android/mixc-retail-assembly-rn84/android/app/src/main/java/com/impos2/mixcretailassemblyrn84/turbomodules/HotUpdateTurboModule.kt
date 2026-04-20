package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.hotupdate.HotUpdateMarker
import com.impos2.adapterv2.hotupdate.HotUpdateBootMarkerStore
import com.impos2.adapterv2.hotupdate.HotUpdatePackageInstaller
import com.impos2.adapterv2.hotupdate.HotUpdatePackageRequest
import org.json.JSONArray
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

@ReactModule(name = HotUpdateTurboModule.NAME)
class HotUpdateTurboModule(reactContext: ReactApplicationContext) :
  NativeHotUpdateTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "HotUpdateTurboModule"
  }

  private data class ActiveDownloadTask(
    val taskId: String,
    val promise: Promise,
    val cancelled: AtomicBoolean = AtomicBoolean(false),
  )

  private val activeDownloads = ConcurrentHashMap<String, ActiveDownloadTask>()
  private val taskSequence = AtomicLong(0L)
  private val downloadExecutor: ExecutorService =
    Executors.newSingleThreadExecutor(HotUpdateTaskThreadFactory())
  @Volatile private var invalidated = false

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
    if (invalidated) {
      rejectPromise(promise, "HOT_UPDATE_ERROR", "HotUpdateTurboModule invalidated")
      return
    }

    val taskId = "download-${taskSequence.incrementAndGet()}"
    val task = ActiveDownloadTask(taskId = taskId, promise = promise)
    activeDownloads[taskId] = task

    runCatching {
      downloadExecutor.execute {
        if (task.cancelled.get() || invalidated) {
          activeDownloads.remove(taskId)
          return@execute
        }

        try {
          runCatching {
            val packageUrls = JSONArray(packageUrlsJson)
            val result = HotUpdatePackageInstaller(reactApplicationContext.applicationContext)
              .downloadPackage(
                HotUpdatePackageRequest(
                  packageId = packageId,
                  packageUrls = List(packageUrls.length()) { index -> packageUrls.optString(index) },
                  packageSha256 = packageSha256,
                  manifestSha256 = manifestSha256,
                  packageSize = packageSize.toLong(),
                ),
                isCancelled = { task.cancelled.get() || invalidated },
              )
            Arguments.createMap().apply {
              putString("installDir", result.installDir.absolutePath)
              putString("entryFile", result.entryFile)
              putString("manifestPath", result.manifestPath.absolutePath)
              putString("packageSha256", result.packageSha256)
              putString("manifestSha256", result.manifestSha256)
            }
          }.onSuccess { result ->
            if (!task.cancelled.get() && !invalidated) {
              resolvePromise(task.promise, result)
            }
          }.onFailure { error ->
            if (!task.cancelled.get() && !invalidated) {
              rejectPromise(task.promise, "HOT_UPDATE_ERROR", error.message, error)
            }
          }
        } finally {
          activeDownloads.remove(taskId)
        }
      }
    }.onFailure { error ->
      activeDownloads.remove(taskId)
      rejectPromise(promise, "HOT_UPDATE_ERROR", error.message, error)
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
      val store = HotUpdateBootMarkerStore(reactApplicationContext.applicationContext)
      val file = store.writeActive(
        HotUpdateMarker(
          releaseId = releaseId,
          packageId = packageId,
          bundleVersion = bundleVersion,
          installDir = installDir,
          entryFile = entryFile ?: "index.android.bundle",
          manifestSha256 = manifestSha256,
          maxLaunchFailures = maxLaunchFailures.toInt(),
        ),
      )
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
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readActive()?.toWritableMap()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun readBootMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readBoot()?.toWritableMap()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun readRollbackMarker(promise: Promise) {
    runCatching {
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).readRollback()?.toWritableMap()
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
      HotUpdateBootMarkerStore(reactApplicationContext.applicationContext).confirmLoadComplete()?.toWritableMap()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("HOT_UPDATE_ERROR", it.message, it)
    }
  }

  override fun invalidate() {
    invalidated = true
    activeDownloads.values.forEach { task ->
      task.cancelled.set(true)
      rejectPromise(task.promise, "HOT_UPDATE_ERROR", "HotUpdateTurboModule invalidated")
    }
    activeDownloads.clear()
    downloadExecutor.shutdownNow()
    super.invalidate()
  }

  private fun resolvePromise(promise: Promise, value: Any?) {
    reactApplicationContext.runOnNativeModulesQueueThread {
      promise.resolve(value)
    }
  }

  private fun rejectPromise(
    promise: Promise,
    code: String,
    message: String?,
    throwable: Throwable? = null,
  ) {
    reactApplicationContext.runOnNativeModulesQueueThread {
      if (throwable != null) {
        promise.reject(code, message, throwable)
      } else {
        promise.reject(code, message)
      }
    }
  }

  private fun HotUpdateMarker.toWritableMap() = Arguments.createMap().apply {
    putString("releaseId", releaseId)
    putString("packageId", packageId)
    putString("bundleVersion", bundleVersion)
    putString("installDir", installDir)
    putString("entryFile", entryFile)
    putString("manifestSha256", manifestSha256)
    putString("bootAttempt", bootAttempt.toString())
    putString("maxLaunchFailures", maxLaunchFailures.toString())
    putString("updatedAt", updatedAt.toString())
    lastBootAt?.let { putString("lastBootAt", it.toString()) }
    lastSuccessfulBootAt?.let { putString("lastSuccessfulBootAt", it.toString()) }
    rollbackReason?.let { putString("rollbackReason", it) }
    failedBootAttempt?.let { putString("failedBootAttempt", it.toString()) }
    rolledBackAt?.let { putString("rolledBackAt", it.toString()) }
  }

  private class HotUpdateTaskThreadFactory : ThreadFactory {
    private val sequence = AtomicLong(0L)

    override fun newThread(runnable: Runnable): Thread {
      return Thread(runnable, "mixc-retail-assembly-rn84-hot-update-${sequence.incrementAndGet()}").apply {
        isDaemon = true
      }
    }
  }
}
