package com.impos2.adapterv2.logger

import android.content.Context
import android.util.Log
import com.impos2.adapterv2.interfaces.ILogManager
import com.impos2.adapterv2.interfaces.LogFile
import com.impos2.adapterv2.interfaces.LogUploadRequest
import com.impos2.adapterv2.interfaces.LogUploadResult
import com.impos2.adapterv2.interfaces.UploadedLogFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.io.File
import java.io.FileWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Base64
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 文件日志管理器。
 *
 * 这个类把控制台日志与落盘日志统一管理，目标是让 adapter-android-v2 在真机问题排查时具备最基本的
 * 可追踪性。当前它负责：
 * - 统一写 debug/info/warn/error；
 * - 按天切分日志文件；
 * - 为 error 单独维护错误日志；
 * - 读取、删除、清理历史日志文件。
 *
 * 实现上使用 IO 协程 + 互斥锁串行化写入，优先保证日志内容完整与文件不互相踩写。
 */
class LogManager private constructor(context: Context) : ILogManager {

  companion object {
    private const val TAG = "LogManager"
    private const val LOG_DIR_NAME = "logs"
    private const val LOG_FILE_EXTENSION = ".log"
    private const val ERROR_LOG_FILE_EXTENSION = ".err.log"
    private const val LOG_RETENTION_DAYS = 15
    private const val DATE_FORMAT = "yyyy-MM-dd"
    private const val TIMESTAMP_FORMAT = "yyyy-MM-dd HH:mm:ss.SSS"

    @Volatile
    private var instance: LogManager? = null

    fun getInstance(context: Context): LogManager =
      instance ?: synchronized(this) {
        instance ?: LogManager(context.applicationContext).also { instance = it }
      }
  }

  // 所有日志都落在应用私有目录下，便于跟随应用生命周期统一管理。
  private val logDir = File(context.filesDir, LOG_DIR_NAME)
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val writeMutex = Mutex()
  private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.getDefault())
  private val timestampFormat = SimpleDateFormat(TIMESTAMP_FORMAT, Locale.getDefault())

  init {
    if (!logDir.exists()) logDir.mkdirs()
    cleanupOldLogs()
  }

  override fun debug(tag: String, message: String) = writeLog("DEBUG", tag, message)

  override fun log(tag: String, message: String) = writeLog("INFO", tag, message)

  override fun warn(tag: String, message: String) = writeLog("WARN", tag, message)

  override fun error(tag: String, message: String) = writeLog("ERROR", tag, message)

  override fun getLogFiles(): List<LogFile> {
    return logDir.listFiles()
      ?.filter { it.isFile && (it.name.endsWith(LOG_FILE_EXTENSION) || it.name.endsWith(ERROR_LOG_FILE_EXTENSION)) }
      ?.sortedByDescending { it.lastModified() }
      ?.map { LogFile(it.name, it.absolutePath, it.length(), it.lastModified()) }
      ?: emptyList()
  }

  override fun uploadLogsForDate(request: LogUploadRequest): LogUploadResult {
    val dayPrefix = request.logDate.trim()
    require(dayPrefix.isNotEmpty()) { "logDate is required" }
    require(request.uploadUrl.isNotBlank()) { "uploadUrl is required" }

    val candidates = getLogFiles()
      .filter { it.fileName.startsWith(dayPrefix) }
      .sortedBy { it.fileName }

    val uploaded = mutableListOf<UploadedLogFile>()
    val skipped = mutableListOf<String>()

    candidates.forEach { file ->
      val content = File(file.filePath).readBytes()
      val checksum = sha256(content)
      val payload = JSONObject().apply {
        put("sandboxId", request.sandboxId)
        put("logDate", request.logDate)
        put("displayIndex", request.displayIndex)
        put("displayRole", request.displayRole)
        put("terminalId", request.terminalId)
        put("commandId", request.commandId)
        put("instanceId", request.instanceId)
        put("releaseId", request.releaseId)
        put("fileName", file.fileName)
        put("contentType", "text/plain")
        put("contentBase64", Base64.getEncoder().encodeToString(content))
        put("metadata", JSONObject(request.metadata + mapOf(
          "checksum" to checksum,
          "overwrite" to request.overwrite,
        )))
      }.toString()

      val response = postJson(request.uploadUrl, payload, request.headers)
      if (response.first !in 200..299) {
        skipped += file.fileName
        Log.e(TAG, "日志上传失败 status=${response.first} file=${file.fileName} body=${response.second}")
      } else {
        uploaded += UploadedLogFile(
          fileName = file.fileName,
          fileSize = file.fileSize,
          uploadedAt = System.currentTimeMillis(),
          checksum = checksum,
          storageKey = null,
          metadata = mapOf(
            "response" to response.second,
          ),
        )
      }
    }

    return LogUploadResult(
      terminalId = request.terminalId,
      displayIndex = request.displayIndex,
      displayRole = request.displayRole,
      logDate = request.logDate,
      uploadedFiles = uploaded,
      skippedFiles = skipped,
      metadata = request.metadata,
    )
  }

  override fun getLogContent(fileName: String, maxBytes: Long): String {
    val file = File(logDir, fileName).takeIf { it.exists() && it.isFile } ?: return ""
    if (file.length() <= maxBytes) return file.readText()

    val bytes = ByteArray(maxBytes.toInt())
    file.inputStream().use {
      it.skip(file.length() - maxBytes)
      it.read(bytes)
    }
    val raw = String(bytes)
    val idx = raw.indexOf('\n')
    return if (idx >= 0) raw.substring(idx + 1) else raw
  }

  override fun deleteLogFile(fileName: String): Boolean {
    return File(logDir, fileName).takeIf { it.exists() && it.isFile }?.delete() ?: false
  }

  override fun clearAllLogs(): Boolean {
    var success = true
    logDir.listFiles()?.forEach {
      if (it.isFile && !it.delete()) success = false
    }
    return success
  }

  override fun getLogDirPath(): String = logDir.absolutePath

  private fun writeLog(level: String, tag: String, message: String) {
    when (level) {
      "DEBUG" -> Log.d(tag, message)
      "INFO" -> Log.i(tag, message)
      "WARN" -> Log.w(tag, message)
      "ERROR" -> Log.e(tag, message)
    }

    scope.launch {
      try {
        writeMutex.withLock {
          val entry = "[${timestampFormat.format(Date())}] [$level] [$tag] $message\n"
          FileWriter(getCurrentLogFile(), true).use { it.append(entry) }
          if (level == "ERROR") {
            FileWriter(getCurrentErrorLogFile(), true).use { it.append(entry) }
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "写入日志文件失败", e)
      }
    }
  }

  private fun getCurrentLogFile(): File = File(logDir, "${dateFormat.format(Date())}$LOG_FILE_EXTENSION")

  private fun getCurrentErrorLogFile(): File =
    File(logDir, "${dateFormat.format(Date())}$ERROR_LOG_FILE_EXTENSION")

  private fun cleanupOldLogs() {
    scope.launch {
      val cutoff = System.currentTimeMillis() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000L
      logDir.listFiles()?.forEach {
        if (it.isFile && it.lastModified() < cutoff) {
          it.delete()
        }
      }
    }
  }

  private fun sha256(content: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(content)
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun postJson(
    targetUrl: String,
    json: String,
    headers: Map<String, String>,
  ): Pair<Int, String> {
    val connection = URL(targetUrl).openConnection() as HttpURLConnection
    return try {
      connection.requestMethod = "POST"
      connection.doOutput = true
      connection.connectTimeout = 30_000
      connection.readTimeout = 30_000
      connection.setRequestProperty("Content-Type", "application/json")
      headers.forEach { (key, value) ->
        connection.setRequestProperty(key, value)
      }
      connection.outputStream.use { output ->
        output.write(json.toByteArray(Charsets.UTF_8))
      }
      val status = connection.responseCode
      val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
        ?.bufferedReader()
        ?.use { it.readText() }
        .orEmpty()
      status to body
    } finally {
      connection.disconnect()
    }
  }
}
