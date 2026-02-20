package com.impos2.turbomodules.external

import com.impos2.turbomodules.external.constants.ErrorCode
import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.models.ExternalCallResponse
import kotlinx.coroutines.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * 外部调用管理器
 * 负责路由请求到对应的 Handler
 *
 * 优化点:
 * 1. 使用 ConcurrentHashMap 保证线程安全
 * 2. 支持请求取消和超时控制
 * 3. 支持多 ReactInstanceManager 场景
 * 4. 增强错误处理和日志
 */
class ExternalCallManager(
    private val handlerRegistry: HandlerRegistry
) {
    private val activeRequests = ConcurrentHashMap<String, Job>()

    /**
     * 执行外部调用
     */
    suspend fun execute(request: ExternalCallRequest): ExternalCallResponse {
        // 使用调用方提供的 requestId，如果没有则自动生成
        val requestId = request.requestId ?: UUID.randomUUID().toString()

        return try {
            // 获取对应的 Handler
            val handler = handlerRegistry.getHandler(request.type, request.method)
                ?: return createErrorResponse(
                    requestId,
                    ErrorCode.NOT_SUPPORTED,
                    "Handler not found for ${request.type}/${request.method}"
                )

            // 检查目标是否可用
            if (!handler.isAvailable(request.target)) {
                return createErrorResponse(
                    requestId,
                    ErrorCode.NOT_FOUND,
                    "Target not available: ${request.target}"
                )
            }

            // 执行调用，添加超时控制
            val job = CoroutineScope(Dispatchers.IO).async {
                withTimeout(request.timeout.toLong()) {
                    handler.handle(request)
                }
            }

            activeRequests[requestId] = job

            val response = try {
                job.await()
            } catch (e: TimeoutCancellationException) {
                activeRequests.remove(requestId)
                return createErrorResponse(
                    requestId,
                    ErrorCode.TIMEOUT,
                    "Request timeout after ${request.timeout}ms"
                )
            } catch (e: CancellationException) {
                activeRequests.remove(requestId)
                return createErrorResponse(
                    requestId,
                    ErrorCode.CANCELLED,
                    "Request cancelled"
                )
            }

            activeRequests.remove(requestId)

            // 在响应中添加 requestId
            response.copy(requestId = requestId)
        } catch (e: Exception) {
            activeRequests.remove(requestId)
            createErrorResponse(
                requestId,
                ErrorCode.UNKNOWN_ERROR,
                "Execution error: ${e.message}"
            )
        }
    }

    /**
     * 检查目标是否可用
     */
    fun isAvailable(type: String, target: String): Boolean {
        return handlerRegistry.getHandlers(type)
            .any { it.isAvailable(target) }
    }

    /**
     * 获取可用目标列表
     */
    fun getAvailableTargets(type: String): List<String> {
        return handlerRegistry.getHandlers(type)
            .flatMap { it.getAvailableTargets() }
            .distinct()
    }

    /**
     * 取消调用
     */
    fun cancel(requestId: String?) {
        if (requestId != null) {
            activeRequests[requestId]?.cancel()
            activeRequests.remove(requestId)
        } else {
            activeRequests.values.forEach { it.cancel() }
            activeRequests.clear()
        }
    }

    private fun createErrorResponse(
        requestId: String,
        code: Int,
        message: String
    ): ExternalCallResponse {
        return ExternalCallResponse(
            requestId = requestId,
            code = code,
            success = false,
            message = message,
            timestamp = System.currentTimeMillis(),
            duration = 0
        )
    }
}
