package com.impos2.adapter.interfaces

enum class ChannelType {
  INTENT,
  AIDL,
  USB,
  SERIAL,
  BLUETOOTH,
  NETWORK,
  SDK,
  HID
}

enum class InteractionMode {
  REQUEST_RESPONSE,
  STREAM,
  PASSIVE
}

data class ChannelDescriptor(
  val type: ChannelType,
  val target: String,
  val mode: InteractionMode,
  val options: Map<String, Any?> = emptyMap()
)

data class ConnectorRequest(
  val channel: ChannelDescriptor,
  val action: String,
  val params: Map<String, Any?> = emptyMap(),
  val timeoutMs: Long = 30_000L
)

data class ConnectorResponse(
  val success: Boolean,
  val code: Int,
  val message: String,
  val data: Map<String, Any?>? = null,
  val timestamp: Long = System.currentTimeMillis(),
  val duration: Long = 0L
)

object ConnectorCodes {
  const val SUCCESS = 0
  const val CANCELED = 1
  const val INVALID_PARAM = 1001
  const val NOT_SUPPORTED = 1002
  const val TIMEOUT = 1003
  const val CAMERA_PERMISSION_DENIED = 2001
  const val CAMERA_OPEN_FAILED = 2002
  const val CAMERA_SCAN_FAILED = 2003
  const val UNKNOWN = 9999
}
