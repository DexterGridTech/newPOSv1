package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.interfaces.LogFile
import com.impos2.adapterv2.interfaces.LogUploadRequest
import com.impos2.adapterv2.interfaces.LogUploadResult
import com.impos2.adapterv2.interfaces.UploadedLogFile
import com.impos2.adapterv2.logger.LogManager
import com.impos2.mixcretailassemblyrn84.turbomodules.NativeLoggerTurboModuleSpec
import org.json.JSONObject

/**
 * Logger TurboModule。
 *
 * 对外暴露统一日志写入与日志文件管理能力。这个模块本身很薄，核心价值是：
 * - 让 JS 不直接接触原生日志目录实现；
 * - 把日志文件列表、内容、删除、清空统一为 Promise 接口；
 * - 保持与 adapter-android-v2 的日志模型一致，方便迁移阶段复用老逻辑。
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
      toJsonString(logManager.getLogFiles())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_LOG_FILES_ERROR", it.message, it)
    }
  }

  override fun uploadLogsForDate(inputJson: String, promise: Promise) {
    runCatching {
      val input = if (inputJson.isBlank()) JSONObject() else JSONObject(inputJson)
      toJsonString(
        logManager.uploadLogsForDate(
          LogUploadRequest(
            uploadUrl = input.optString("uploadUrl").ifBlank { error("uploadUrl is required") },
            logDate = input.optString("logDate").ifBlank { error("logDate is required") },
            terminalId = input.optString("terminalId").ifBlank { null },
            sandboxId = input.optString("sandboxId").ifBlank { null },
            commandId = input.optString("commandId").ifBlank { null },
            instanceId = input.optString("instanceId").ifBlank { null },
            releaseId = input.optString("releaseId").ifBlank { null },
            displayIndex = if (input.has("displayIndex")) input.optInt("displayIndex", 0) else 0,
            displayRole = input.optString("displayRole").ifBlank { "PRIMARY" },
            overwrite = !input.has("overwrite") || input.optBoolean("overwrite", true),
            headers = jsonObjectToStringMap(input.optJSONObject("headers")),
            metadata = jsonObjectToAnyMap(input.optJSONObject("metadata")),
          ),
        ),
      )
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("UPLOAD_LOGS_FOR_DATE_ERROR", it.message, it)
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

  private fun toWritableMap(result: LogUploadResult): WritableMap {
    return Arguments.createMap().apply {
      putString("terminalId", result.terminalId)
      putInt("displayIndex", result.displayIndex)
      putString("displayRole", result.displayRole)
      putString("logDate", result.logDate)
      putArray("uploadedFiles", Arguments.createArray().apply {
        result.uploadedFiles.forEach { pushMap(toWritableMap(it)) }
      })
      putArray("skippedFiles", Arguments.createArray().apply {
        result.skippedFiles.forEach { pushString(it) }
      })
      putMap("metadata", toWritableMap(result.metadata))
    }
  }

  private fun toWritableMap(file: UploadedLogFile): WritableMap {
    return Arguments.createMap().apply {
      putString("fileName", file.fileName)
      putDouble("fileSize", file.fileSize.toDouble())
      putDouble("uploadedAt", file.uploadedAt.toDouble())
      putString("checksum", file.checksum)
      putString("storageKey", file.storageKey)
      putMap("metadata", toWritableMap(file.metadata))
    }
  }

  private fun toWritableMap(value: Map<String, Any?>): WritableMap {
    return Arguments.createMap().apply {
      value.forEach { (key, item) ->
        when (item) {
          null -> putNull(key)
          is String -> putString(key, item)
          is Boolean -> putBoolean(key, item)
          is Int -> putInt(key, item)
          is Long -> putDouble(key, item.toDouble())
          is Double -> putDouble(key, item)
          is Float -> putDouble(key, item.toDouble())
          else -> putString(key, item.toString())
        }
      }
    }
  }

  private fun readableMapToStringMap(value: ReadableMap?): Map<String, String> {
    if (value == null) return emptyMap()
    val iterator = value.keySetIterator()
    val result = mutableMapOf<String, String>()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      if (!value.isNull(key)) {
        result[key] = value.getString(key) ?: value.getType(key).name
      }
    }
    return result
  }

  private fun readableMapToAnyMap(value: ReadableMap?): Map<String, Any?> {
    if (value == null) return emptyMap()
    val iterator = value.keySetIterator()
    val result = mutableMapOf<String, Any?>()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      result[key] = when (value.getType(key)) {
        ReadableType.Boolean -> value.getBoolean(key)
        ReadableType.Number -> value.getDouble(key)
        ReadableType.String -> value.getString(key)
        else -> value.getType(key).name
      }
    }
    return result
  }

  private fun jsonObjectToStringMap(value: JSONObject?): Map<String, String> {
    if (value == null) return emptyMap()
    return buildMap {
      val iterator = value.keys()
      while (iterator.hasNext()) {
        val key = iterator.next()
        val item = value.opt(key)
        if (item != null && item != JSONObject.NULL) {
          put(key, item.toString())
        }
      }
    }
  }

  private fun jsonObjectToAnyMap(value: JSONObject?): Map<String, Any?> {
    if (value == null) return emptyMap()
    return buildMap {
      val iterator = value.keys()
      while (iterator.hasNext()) {
        val key = iterator.next()
        val item = value.opt(key)
        put(key, if (item == JSONObject.NULL) null else item)
      }
    }
  }

  private fun toJsonString(logFiles: List<LogFile>): String {
    return org.json.JSONArray().apply {
      logFiles.forEach { put(logFileToJson(it)) }
    }.toString()
  }

  private fun toJsonString(result: LogUploadResult): String {
    return JSONObject().apply {
      put("terminalId", result.terminalId)
      put("displayIndex", result.displayIndex)
      put("displayRole", result.displayRole)
      put("logDate", result.logDate)
      put("uploadedFiles", org.json.JSONArray().apply {
        result.uploadedFiles.forEach { put(uploadedLogFileToJson(it)) }
      })
      put("skippedFiles", org.json.JSONArray(result.skippedFiles))
      put("metadata", JSONObject(result.metadata))
    }.toString()
  }

  private fun logFileToJson(logFile: LogFile): JSONObject {
    return JSONObject().apply {
      put("fileName", logFile.fileName)
      put("filePath", logFile.filePath)
      put("fileSize", logFile.fileSize)
      put("lastModified", logFile.lastModified)
    }
  }

  private fun uploadedLogFileToJson(file: UploadedLogFile): JSONObject {
    return JSONObject().apply {
      put("fileName", file.fileName)
      put("fileSize", file.fileSize)
      put("uploadedAt", file.uploadedAt)
      put("checksum", file.checksum)
      put("storageKey", file.storageKey)
      put("metadata", JSONObject(file.metadata))
    }
  }
}
