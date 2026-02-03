package com.impos2.turbomodules.external.models

import com.facebook.react.bridge.ReadableMap

/**
 * 外部调用请求数据类
 * 封装所有调用所需的参数
 */
data class ExternalCallRequest(
    val requestId: String? = null,      // 请求ID（可选，用于取消请求）
    val type: String,                    // 调用类型: APP/HARDWARE/SYSTEM
    val method: String,                  // 调用方式: INTENT/AIDL/SDK/SERIAL/USB/BLUETOOTH/NETWORK
    val target: String,                  // 目标标识（包名、设备ID、服务名等）
    val action: String,                  // 操作/动作
    val params: ReadableMap? = null,     // 请求参数
    val timeout: Int = 30000,            // 超时时间（毫秒）
    val options: ReadableMap? = null     // 额外配置
)
