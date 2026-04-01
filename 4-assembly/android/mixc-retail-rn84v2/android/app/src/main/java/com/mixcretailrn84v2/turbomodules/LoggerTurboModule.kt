package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapter.interfaces.LogFile
import com.impos2.adapter.logger.LogManager
import com.impos2.mixcretailrn84v2.turbomodules.NativeLoggerTurboModuleSpec

@ReactModule(name = LoggerTurboModule.NAME)
class LoggerTurboModule(reactContext: ReactApplicationContext) :
  NativeLoggerTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "LoggerTurboModule"
  }

  private val logManager by lazy { LogManager.getInstance(reactApplicationContext) }

  override fun getName(): String = NAME

  override fun debug(tag: String, message: String) {
    logManager.debug(tag, message)
  }

  override fun log(tag: String, message: String) {
    logManager.log(tag, message)
  }

  override fun warn(tag: String, message: String) {
    logManager.warn(tag, message)
  }

  override fun error(tag: String, message: String) {
    logManager.error(tag, message)
  }

  override fun getLogFiles(promise: Promise) {
    runCatching {
      Arguments.createArray().apply {
        logManager.getLogFiles().forEach { pushMap(toWritableMap(it)) }
      }
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOG_FILES_ERROR", it.message, it)
    }
  }

  override fun getLogContent(fileName: String, maxBytes: Double, promise: Promise) {
    runCatching {
      logManager.getLogContent(fileName, maxBytes.toLong())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOG_CONTENT_ERROR", it.message, it)
    }
  }

  override fun deleteLogFile(fileName: String, promise: Promise) {
    runCatching {
      logManager.deleteLogFile(fileName)
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("DELETE_LOG_FILE_ERROR", it.message, it)
    }
  }

  override fun clearAllLogs(promise: Promise) {
    runCatching {
      logManager.clearAllLogs()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("CLEAR_LOGS_ERROR", it.message, it)
    }
  }

  override fun getLogDirPath(promise: Promise) {
    runCatching {
      logManager.getLogDirPath()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOG_DIR_ERROR", it.message, it)
    }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  private fun toWritableMap(logFile: LogFile): WritableMap {
    return Arguments.createMap().apply {
      putString("fileName", logFile.fileName)
      putString("filePath", logFile.filePath)
      putDouble("fileSize", logFile.fileSize.toDouble())
      putDouble("lastModified", logFile.lastModified.toDouble())
    }
  }
}
