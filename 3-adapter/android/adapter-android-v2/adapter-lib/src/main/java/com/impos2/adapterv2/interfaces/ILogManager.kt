package com.impos2.adapterv2.interfaces

/**
 * 文件日志能力抽象。
 *
 * 除了简单写日志外，它还承担日志文件管理职责，方便测试页和排查工具直接读取历史日志。
 */
interface ILogManager {
  fun debug(tag: String, message: String)
  fun log(tag: String, message: String)
  fun warn(tag: String, message: String)
  fun error(tag: String, message: String)
  fun getLogFiles(): List<LogFile>
  fun uploadLogsForDate(request: LogUploadRequest): LogUploadResult
  fun getLogContent(fileName: String, maxBytes: Long = 200 * 1024L): String
  fun deleteLogFile(fileName: String): Boolean
  fun clearAllLogs(): Boolean
  fun getLogDirPath(): String
}
