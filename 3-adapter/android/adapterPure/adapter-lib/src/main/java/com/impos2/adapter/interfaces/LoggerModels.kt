package com.impos2.adapter.interfaces

data class LogFile(
  val fileName: String,
  val filePath: String,
  val fileSize: Long,
  val lastModified: Long
)
