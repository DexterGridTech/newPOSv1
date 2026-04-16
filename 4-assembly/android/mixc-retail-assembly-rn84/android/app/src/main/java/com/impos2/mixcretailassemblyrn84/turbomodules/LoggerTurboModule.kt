package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.interfaces.LogFile
import com.impos2.adapterv2.logger.LogManager
import com.impos2.mixcretailassemblyrn84.turbomodules.NativeLoggerTurboModuleSpec

/**
 * Logger TurboModule。
 *
 * 对外暴露统一日志写入与日志文件管理能力。这个模块本身很薄，核心价值是：
 * - 让 JS 不直接接触原生日志目录实现；
 * - 把日志文件列表、内容、删除、清空统一为 Promise 接口；
 * - 保持与 adapterPure 的日志模型一致，方便迁移阶段复用老逻辑。
 */
@ReactModule(name = LoggerTurboModule.NAME)
class LoggerTurboModule(reactContext: ReactApplicationContext) :
  NativeLoggerTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "LoggerTurboModule"
  }

  /**
   * 底层日志管理器。
   */
  private val logManager by lazy { LogManager.getInstance(reactApplicationContext) }

  override fun getName(): String = NAME

  /**
   * 写入 debug 日志。
   */
  override fun debug(tag: String, message: String) {
    logManager.debug(tag, message)
  }

  /**
   * 写入普通日志。
   */
  override fun log(tag: String, message: String) {
    logManager.log(tag, message)
  }

  /**
   * 写入 warning 日志。
   */
  override fun warn(tag: String, message: String) {
    logManager.warn(tag, message)
  }

  /**
   * 写入 error 日志。
   */
  override fun error(tag: String, message: String) {
    logManager.error(tag, message)
  }

  /**
   * 获取日志文件列表。
   */
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

  /**
   * 读取某个日志文件内容。
   */
  override fun getLogContent(fileName: String, maxBytes: Double, promise: Promise) {
    runCatching {
      logManager.getLogContent(fileName, maxBytes.toLong())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOG_CONTENT_ERROR", it.message, it)
    }
  }

  /**
   * 删除单个日志文件。
   */
  override fun deleteLogFile(fileName: String, promise: Promise) {
    runCatching {
      logManager.deleteLogFile(fileName)
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("DELETE_LOG_FILE_ERROR", it.message, it)
    }
  }

  /**
   * 清空所有日志。
   */
  override fun clearAllLogs(promise: Promise) {
    runCatching {
      logManager.clearAllLogs()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("CLEAR_LOGS_ERROR", it.message, it)
    }
  }

  /**
   * 返回日志目录路径。
   */
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

  /**
   * 把日志文件元数据转成 JS 结构。
   */
  private fun toWritableMap(logFile: LogFile): WritableMap {
    return Arguments.createMap().apply {
      putString("fileName", logFile.fileName)
      putString("filePath", logFile.filePath)
      putDouble("fileSize", logFile.fileSize.toDouble())
      putDouble("lastModified", logFile.lastModified.toDouble())
    }
  }
}
