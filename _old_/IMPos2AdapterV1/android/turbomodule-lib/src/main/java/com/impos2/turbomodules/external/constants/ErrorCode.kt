package com.impos2.turbomodules.external.constants

/**
 * 标准错误码
 * 与 TypeScript 层的 ErrorCode 枚举保持一致
 */
object ErrorCode {
    const val SUCCESS = 0                    // 成功
    const val TIMEOUT = 1001                 // 超时
    const val CANCELLED = 1002               // 用户取消
    const val NOT_FOUND = 2001               // 目标未找到
    const val NOT_SUPPORTED = 2002           // 不支持的操作
    const val PERMISSION_DENIED = 3001       // 权限拒绝
    const val DEVICE_NOT_READY = 4001        // 设备未就绪
    const val DEVICE_BUSY = 4002             // 设备忙碌
    const val COMMUNICATION_ERROR = 5001     // 通信错误
    const val INVALID_PARAMS = 6001          // 参数错误
    const val INVALID_RESPONSE = 6002        // 响应格式错误
    const val UNKNOWN_ERROR = 9999           // 未知错误
}
