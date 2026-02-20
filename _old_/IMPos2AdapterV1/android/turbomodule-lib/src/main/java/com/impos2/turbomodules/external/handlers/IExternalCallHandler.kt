package com.impos2.turbomodules.external.handlers

import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.models.ExternalCallResponse

/**
 * 外部调用处理器接口
 * 每种调用方式实现一个 Handler
 */
interface IExternalCallHandler {
    /**
     * 处理调用请求
     */
    suspend fun handle(request: ExternalCallRequest): ExternalCallResponse

    /**
     * 检查目标是否可用
     */
    fun isAvailable(target: String): Boolean

    /**
     * 获取支持的目标列表
     */
    fun getAvailableTargets(): List<String>

    /**
     * 取消调用
     */
    fun cancel()
}
