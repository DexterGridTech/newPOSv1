package com.impos2.adapterv2.interfaces

/**
 * 单个日志文件的元信息。
 */
data class LogFile(
  val fileName: String,
  val filePath: String,
  val fileSize: Long,
  val lastModified: Long
)

data class LogUploadRequest(
  val uploadUrl: String,
  val logDate: String,
  val terminalId: String?,
  val sandboxId: String?,
  val commandId: String?,
  val instanceId: String?,
  val releaseId: String?,
  val displayIndex: Int,
  val displayRole: String,
  val overwrite: Boolean,
  val headers: Map<String, String> = emptyMap(),
  val metadata: Map<String, Any?> = emptyMap()
)

data class UploadedLogFile(
  val fileName: String,
  val fileSize: Long,
  val uploadedAt: Long,
  val checksum: String,
  val storageKey: String?,
  val metadata: Map<String, Any?> = emptyMap()
)

data class LogUploadResult(
  val terminalId: String?,
  val displayIndex: Int,
  val displayRole: String,
  val logDate: String,
  val uploadedFiles: List<UploadedLogFile>,
  val skippedFiles: List<String> = emptyList(),
  val metadata: Map<String, Any?> = emptyMap()
)
