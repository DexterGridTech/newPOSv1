package com.impos2.turbomodules.external.handlers

import com.impos2.turbomodules.external.constants.ErrorCode
import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.models.ExternalCallResponse

/**
 * 硬件调用占位符 Handler
 * 用于 HARDWARE 类型的调用（SERIAL/USB/BLUETOOTH/SDK）
 * 实际项目中需要根据具体硬件实现
 */
class HardwarePlaceholderHandler : IExternalCallHandler {

    override suspend fun handle(request: ExternalCallRequest): ExternalCallResponse {
        val startTime = System.currentTimeMillis()

        return ExternalCallResponse(
            requestId = request.requestId,
            code = ErrorCode.NOT_SUPPORTED,
            success = false,
            message = "Hardware call not implemented yet: ${request.method}",
            timestamp = System.currentTimeMillis(),
            duration = System.currentTimeMillis() - startTime
        )
    }

    override fun isAvailable(target: String): Boolean {
        return false
    }

    override fun getAvailableTargets(): List<String> {
        return emptyList()
    }

    override fun cancel() {
        // 占位符实现
    }
}
