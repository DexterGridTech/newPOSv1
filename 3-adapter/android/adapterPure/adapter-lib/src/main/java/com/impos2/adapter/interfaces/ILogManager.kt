package com.impos2.adapter.interfaces

interface ILogManager {
  fun debug(tag: String, message: String)
  fun log(tag: String, message: String)
  fun warn(tag: String, message: String)
  fun error(tag: String, message: String)
  fun getLogFiles(): List<LogFile>
  fun getLogContent(fileName: String, maxBytes: Long = 200 * 1024L): String
  fun deleteLogFile(fileName: String): Boolean
  fun clearAllLogs(): Boolean
  fun getLogDirPath(): String
}
