package com.impos2.posadapter.turbomodules.logger

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.*

class LogManager private constructor(private val context: Context) {

    companion object {
        private const val TAG = "LogManager"
        private const val LOG_DIR_NAME = "logs"
        private const val LOG_FILE_EXTENSION = ".log"
        private const val LOG_RETENTION_DAYS = 30
        private const val DATE_FORMAT = "yyyy-MM-dd"
        private const val TIMESTAMP_FORMAT = "yyyy-MM-dd HH:mm:ss.SSS"

        @Volatile
        private var instance: LogManager? = null

        fun getInstance(context: Context): LogManager =
            instance ?: synchronized(this) {
                instance ?: LogManager(context.applicationContext).also { instance = it }
            }
    }

    private val logDir = File(context.filesDir, LOG_DIR_NAME)
    private val scope = CoroutineScope(Dispatchers.IO)
    private val writeMutex = Mutex()
    private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.getDefault())
    private val timestampFormat = SimpleDateFormat(TIMESTAMP_FORMAT, Locale.getDefault())

    init {
        if (!logDir.exists()) logDir.mkdirs()
        cleanupOldLogs()
    }

    fun debug(tag: String, message: String) = writeLog("DEBUG", tag, message)
    fun log(tag: String, message: String) = writeLog("INFO", tag, message)
    fun warn(tag: String, message: String) = writeLog("WARN", tag, message)
    fun error(tag: String, message: String) = writeLog("ERROR", tag, message)

    private fun writeLog(level: String, tag: String, message: String) {
        when (level) {
            "DEBUG" -> Log.d(tag, message)
            "INFO"  -> Log.i(tag, message)
            "WARN"  -> Log.w(tag, message)
            "ERROR" -> Log.e(tag, message)
        }
        scope.launch {
            try {
                writeMutex.withLock {
                    val entry = "[${timestampFormat.format(Date())}] [$level] [$tag] $message\n"
                    FileWriter(getCurrentLogFile(), true).use { it.append(entry) }
                }
            } catch (e: Exception) {
                Log.e(TAG, "写入日志文件失败", e)
            }
        }
    }

    private fun getCurrentLogFile() = File(logDir, "${dateFormat.format(Date())}$LOG_FILE_EXTENSION")

    private fun cleanupOldLogs() {
        scope.launch {
            val cutoff = System.currentTimeMillis() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000L
            logDir.listFiles()?.forEach { if (it.isFile && it.lastModified() < cutoff) it.delete() }
        }
    }

    fun getLogFiles(): List<Map<String, Any>> =
        logDir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(LOG_FILE_EXTENSION) }
            ?.sortedByDescending { it.lastModified() }
            ?.map { mapOf("fileName" to it.name, "filePath" to it.absolutePath, "fileSize" to it.length(), "lastModified" to it.lastModified()) }
            ?: emptyList()

    fun getLogContent(fileName: String, maxBytes: Long = 200 * 1024L): String {
        val file = File(logDir, fileName).takeIf { it.exists() && it.isFile } ?: return ""
        if (file.length() <= maxBytes) return file.readText()
        // 只读取末尾 maxBytes 字节，保留最新日志
        val buf = ByteArray(maxBytes.toInt())
        file.inputStream().use { it.skip(file.length() - maxBytes); it.read(buf) }
        val raw = String(buf)
        // 从第一个换行符开始，避免截断首行
        val idx = raw.indexOf('\n')
        return if (idx >= 0) raw.substring(idx + 1) else raw
    }

    fun deleteLogFile(fileName: String): Boolean =
        File(logDir, fileName).takeIf { it.exists() && it.isFile }?.delete() ?: false

    fun clearAllLogs(): Boolean {
        var success = true
        logDir.listFiles()?.forEach { if (it.isFile && !it.delete()) success = false }
        return success
    }

    fun getLogDirPath(): String = logDir.absolutePath
}
