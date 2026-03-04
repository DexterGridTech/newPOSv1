package com.impos2.adapter

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import org.json.JSONObject

class ScriptsTurboModule(reactContext: ReactApplicationContext) :
    NativeScriptsTurboModuleSpec(reactContext) {

    private var executionCount = 0
    private var successCount = 0
    private var failedCount = 0

    override fun getName() = NAME

    override fun executeScript(
        script: String,
        params: String,
        timeout: Double,
        promise: Promise
    ) {
        executionCount++
        try {
            // 验证输入
            if (script.isEmpty() || script.length > 10000) {
                throw IllegalArgumentException("Invalid script length")
            }

            // 执行脚本（简化实现）
            val result = executeInSandbox(script, params, timeout.toLong())
            successCount++
            promise.resolve(result)
        } catch (e: Exception) {
            failedCount++
            promise.reject("SCRIPT_ERROR", e.message, e)
        }
    }

    override fun resolveNativeCall(callId: String, result: String, promise: Promise) {
        try {
            // 处理原生调用结果
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RESOLVE_ERROR", e.message, e)
        }
    }

    override fun getStats(promise: Promise) {
        val stats = WritableNativeMap()
        stats.putInt("total", executionCount)
        stats.putInt("success", successCount)
        stats.putInt("failed", failedCount)
        promise.resolve(stats)
    }

    override fun clearStats(promise: Promise) {
        executionCount = 0
        successCount = 0
        failedCount = 0
        promise.resolve(null)
    }

    private fun executeInSandbox(script: String, params: String, timeout: Long): String {
        // 简化的沙箱执行实现
        return JSONObject().apply {
            put("success", true)
            put("result", "Script executed")
        }.toString()
    }

    companion object {
        const val NAME = "ScriptsTurboModule"
    }
}
