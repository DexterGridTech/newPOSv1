package com.impos2.turbomodules.external.models

/**
 * 外部调用响应数据类
 * 标准化的响应格式
 */
data class ExternalCallResponse(
    val requestId: String? = null,       // 请求ID
    val code: Int,                       // 错误码
    val success: Boolean,                // 是否成功
    val message: String,                 // 消息
    val data: Any? = null,               // 响应数据
    val raw: Any? = null,                // 原始响应（用于调试）
    val timestamp: Long,                 // 时间戳
    val duration: Long                   // 耗时（毫秒）
)
