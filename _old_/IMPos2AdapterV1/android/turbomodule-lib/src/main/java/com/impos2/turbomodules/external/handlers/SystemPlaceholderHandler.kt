package com.impos2.turbomodules.external.handlers

import com.impos2.turbomodules.external.constants.ErrorCode
import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.models.ExternalCallResponse

/**
 * 系统调用占位符 Handler
 * 用于 SYSTEM 类型的调用
 * 实际项目中需要根据具体系统服务实现
 */
class SystemPlaceholderHandler : IExternalCallHandler {

    override suspend fun handle(request: ExternalCallRequest): ExternalCallResponse {
        val startTime = System.currentTimeMillis()

        return ExternalCallResponse(
            requestId = request.requestId,
            code = ErrorCode.NOT_SUPPORTED,
            success = false,
            message = "System call not implemented yet: ${request.method}",
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
