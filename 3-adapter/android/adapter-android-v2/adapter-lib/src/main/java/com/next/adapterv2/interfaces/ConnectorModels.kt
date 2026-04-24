package com.next.adapterv2.interfaces

/**
 * 连接通道类型。
 *
 * 它描述的是“这次调用要走哪一类底层能力”，不是具体 target。具体落到哪个 target，由
 * [ChannelDescriptor.target] 决定。
 */
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

/**
 * 交互模式。
 *
 * - REQUEST_RESPONSE：一次请求对应一次结果
 * - STREAM：建立持续数据流订阅
 * - PASSIVE：被动监听宿主外部事件
 */
enum class InteractionMode {
  REQUEST_RESPONSE,
  STREAM,
  PASSIVE
}

/**
 * 一条完整 channel 描述。
 *
 * 这是 Connector 路由决策的最小输入单元：
 * - `type` 决定底层能力类别
 * - `target` 决定实际业务目标
 * - `mode` 决定交互方式
 * - `options` 留给特定通道做扩展配置
 */
data class ChannelDescriptor(
  val type: ChannelType,
  val target: String,
  val mode: InteractionMode,
  val options: Map<String, Any?> = emptyMap()
)

/**
 * Connector 调用请求。
 *
 * `action` 和 `params` 共同决定这次调用的实际业务意图，`timeoutMs` 则为整次调用设定超时边界。
 */
data class ConnectorRequest(
  val channel: ChannelDescriptor,
  val action: String,
  val params: Map<String, Any?> = emptyMap(),
  val timeoutMs: Long = 30_000L
)

/**
 * Connector 调用结果。
 *
 * 统一返回结构的意义在于：不管底层能力差异多大，上层拿到的都是同一类结果模型，便于测试、
 * 记录日志和桥接到 RN。
 */
data class ConnectorResponse(
  val success: Boolean,
  val code: Int,
  val message: String,
  val data: Map<String, Any?>? = null,
  val timestamp: Long = System.currentTimeMillis(),
  val duration: Long = 0L
)

/**
 * Connector 结果码。
 *
 * 这里保留的是 adapter 层统一可理解的错误分类，避免把具体平台异常直接泄露给上层业务。
 */
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
