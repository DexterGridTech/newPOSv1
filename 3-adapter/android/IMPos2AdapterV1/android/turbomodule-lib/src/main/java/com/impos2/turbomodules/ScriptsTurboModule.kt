package com.impos2.turbomodules

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.impos2.turbomodules.scripts.ScriptEngineManager

/**
 * Scripts TurboModule
 *
 * 优化点:
 * 1. 使用单例 ScriptEngineManager，支持多 ReactInstanceManager 场景
 * 2. 提供脚本执行接口，桥接 JS 层的 react-native-quickjs
 * 3. 支持脚本执行超时控制
 * 4. 提供详细的错误信息和执行时间统计
 *
 * 设计思路:
 * - 由于 react-native-quickjs 是纯 JS 库，在 Hermes 引擎下可以正常工作
 * - TurboModule 主要负责参数验证、超时控制、错误处理
 * - 实际的脚本执行由 JS 层的 react-native-quickjs 完成
 */
class ScriptsTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ScriptsTurboModule"
        const val NAME = "ScriptsTurboModule"
    }

    private val scriptEngineManager: ScriptEngineManager by lazy {
        ScriptEngineManager.getInstance(reactApplicationContext)
    }

    override fun getName(): String = NAME

    /**
     * 验证脚本执行选项
     * 在原生层进行基础验证，确保参数合法
     */
    @ReactMethod
    fun validateScriptOptions(options: ReadableMap, promise: Promise) {
        try {
            val script = options.getString("script")
            if (script.isNullOrBlank()) {
                promise.reject("INVALID_SCRIPT", "Script cannot be empty")
                return
            }

            val timeout = if (options.hasKey("timeout")) {
                options.getInt("timeout")
            } else {
                5000
            }

            if (timeout <= 0 || timeout > 60000) {
                promise.reject("INVALID_TIMEOUT", "Timeout must be between 1 and 60000ms")
                return
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "validateScriptOptions 失败", e)
            promise.reject("VALIDATION_ERROR", e.message, e)
        }
    }

    /**
     * 记录脚本执行日志
     * 用于调试和监控
     */
    @ReactMethod
    fun logScriptExecution(
        script: String,
        executionTime: Int,
        success: Boolean,
        error: String?
    ) {
        try {
            scriptEngineManager.logExecution(script, executionTime, success, error)
        } catch (e: Exception) {
            Log.e(TAG, "logScriptExecution 失败", e)
        }
    }

    /**
     * 获取脚本执行统计信息
     */
    @ReactMethod
    fun getExecutionStats(promise: Promise) {
        try {
            val stats = scriptEngineManager.getExecutionStats()
            promise.resolve(stats)
        } catch (e: Exception) {
            Log.e(TAG, "getExecutionStats 失败", e)
            promise.reject("GET_STATS_ERROR", e.message, e)
        }
    }

    /**
     * 清除脚本执行统计信息
     */
    @ReactMethod
    fun clearExecutionStats(promise: Promise) {
        try {
            scriptEngineManager.clearExecutionStats()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "clearExecutionStats 失败", e)
            promise.reject("CLEAR_STATS_ERROR", e.message, e)
        }
    }
}
