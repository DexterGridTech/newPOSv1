package com.impos2.turbomodules.logger

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

/**
 * 日志管理器（单例模式）
 *
 * 优化点:
 * 1. 支持多 ReactInstanceManager 场景
 * 2. 自动清理 30 天前的日志
 * 3. 线程安全的日志写入
 * 4. 支持日志级别过滤
 */
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

        fun getInstance(context: Context): LogManager {
            return instance ?: synchronized(this) {
                instance ?: LogManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val logDir: File = File(context.filesDir, LOG_DIR_NAME)
    private val scope = CoroutineScope(Dispatchers.IO)
    private val writeMutex = Mutex()
    private val dateFormat = SimpleDateFormat(DATE_FORMAT, Locale.getDefault())
    private val timestampFormat = SimpleDateFormat(TIMESTAMP_FORMAT, Locale.getDefault())

    init {
        if (!logDir.exists()) {
            logDir.mkdirs()
            Log.d(TAG, "日志目录创建: ${logDir.absolutePath}")
        }
        cleanupOldLogs()
    }

    /**
     * 写入 DEBUG 级别日志
     */
    fun debug(tag: String, message: String) {
        writeLog("DEBUG", tag, message)
    }

    /**
     * 写入 INFO 级别日志
     */
    fun log(tag: String, message: String) {
        writeLog("INFO", tag, message)
    }

    /**
     * 写入 WARN 级别日志
     */
    fun warn(tag: String, message: String) {
        writeLog("WARN", tag, message)
    }

    /**
     * 写入 ERROR 级别日志
     */
    fun error(tag: String, message: String, throwable: Throwable? = null) {
        val fullMessage = if (throwable != null) {
            "$message\n${Log.getStackTraceString(throwable)}"
        } else {
            message
        }
        writeLog("ERROR", tag, fullMessage)
    }

    /**
     * 核心写入方法（线程安全）
     */
    private fun writeLog(level: String, tag: String, message: String) {
        // 同时输出到 Logcat
        when (level) {
            "DEBUG" -> Log.d(tag, message)
            "INFO" -> Log.i(tag, message)
            "WARN" -> Log.w(tag, message)
            "ERROR" -> Log.e(tag, message)
        }

        // 异步写入文件
        scope.launch {
            try {
                writeMutex.withLock {
                    val logFile = getCurrentLogFile()
                    val logEntry = buildLogEntry(level, tag, message)
                    FileWriter(logFile, true).use { writer ->
                        writer.append(logEntry)
                        writer.append("\n")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "写入日志文件失败", e)
            }
        }
    }

    /**
     * 构建日志条目
     */
    private fun buildLogEntry(level: String, tag: String, message: String): String {
        val timestamp = timestampFormat.format(Date())
        return "[$timestamp] [$level] [$tag] $message"
    }

    /**
     * 获取当前日志文件
     */
    private fun getCurrentLogFile(): File {
        val today = dateFormat.format(Date())
        return File(logDir, "$today$LOG_FILE_EXTENSION")
    }

    /**
     * 清理 30 天前的日志文件
     */
    private fun cleanupOldLogs() {
        scope.launch {
            try {
                val cutoffTime = System.currentTimeMillis() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000L)
                logDir.listFiles()?.forEach { file ->
                    if (file.isFile && file.lastModified() < cutoffTime) {
                        val deleted = file.delete()
                        Log.d(TAG, "清理旧日志: ${file.name}, 结果: $deleted")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "清理旧日志失败", e)
            }
        }
    }

    /**
     * 获取所有日志文件列表
     */
    fun getLogFiles(): List<Map<String, Any>> {
        return try {
            logDir.listFiles()
                ?.filter { it.isFile && it.name.endsWith(LOG_FILE_EXTENSION) }
                ?.sortedByDescending { it.lastModified() }
                ?.map { file ->
                    mapOf(
                        "name" to file.name,
                        "path" to file.absolutePath,
                        "size" to file.length(),
                        "lastModified" to file.lastModified()
                    )
                } ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "获取日志文件列表失败", e)
            emptyList()
        }
    }

    /**
     * 读取指定日志文件内容
     */
    fun getLogContent(fileName: String): String {
        return try {
            val file = File(logDir, fileName)
            if (file.exists() && file.isFile) {
                file.readText()
            } else {
                ""
            }
        } catch (e: Exception) {
            Log.e(TAG, "读取日志文件失败: $fileName", e)
            ""
        }
    }

    /**
     * 删除指定日志文件
     */
    fun deleteLogFile(fileName: String): Boolean {
        return try {
            val file = File(logDir, fileName)
            if (file.exists() && file.isFile) {
                file.delete()
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "删除日志文件失败: $fileName", e)
            false
        }
    }

    /**
     * 清空所有日志文件
     */
    fun clearAllLogs(): Boolean {
        return try {
            var success = true
            logDir.listFiles()?.forEach { file ->
                if (file.isFile && !file.delete()) {
                    success = false
                }
            }
            success
        } catch (e: Exception) {
            Log.e(TAG, "清空所有日志失败", e)
            false
        }
    }

    /**
     * 获取日志目录路径
     */
    fun getLogDirPath(): String {
        return logDir.absolutePath
    }
}
