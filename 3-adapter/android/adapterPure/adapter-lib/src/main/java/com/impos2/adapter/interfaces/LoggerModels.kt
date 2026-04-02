package com.impos2.adapter.interfaces

/**
 * 单个日志文件的元信息。
 */
data class LogFile(
  val fileName: String,
  val filePath: String,
  val fileSize: Long,
  val lastModified: Long
)
