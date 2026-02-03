package com.impos2.turbomodules

import com.facebook.react.bridge.*
import com.impos2.turbomodules.external.ExternalCallManager
import com.impos2.turbomodules.external.HandlerRegistry
import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.utils.DataConverter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * ExternalCall TurboModule 实现
 * 提供外部调用能力，支持 Intent、AIDL、SDK、硬件等多种调用方式
 *
 * 优化点:
 * 1. 支持多 ReactInstanceManager 场景（每个实例独立的 Manager）
 * 2. 增强错误处理和参数验证
 * 3. 使用协程优化异步调用
 */
class ExternalCallTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ExternalCallTurboModule"
    }

    // 每个 ReactContext 独立的 Manager 实例
    private val handlerRegistry = HandlerRegistry(reactContext)
    private val callManager = ExternalCallManager(handlerRegistry)

    override fun getName(): String = NAME

    /**
     * 执行外部调用
     * @param request 调用请求（JSON 字符串）
     */
    @ReactMethod
    fun call(request: String, promise: Promise) {
        try {
            val requestObj = parseRequest(request)

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val response = callManager.execute(requestObj)
                    val responseMap = convertResponseToWritableMap(response)
                    promise.resolve(responseMap)
                } catch (e: Exception) {
                    promise.reject("CALL_ERROR", "Call execution failed: ${e.message}", e)
                }
            }
        } catch (e: Exception) {
            promise.reject("PARSE_ERROR", "Failed to parse request: ${e.message}", e)
        }
    }

    /**
     * 检查目标是否可用
     */
    @ReactMethod
    fun isAvailable(type: String, target: String, promise: Promise) {
        try {
            val available = callManager.isAvailable(type, target)
            promise.resolve(available)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", "Failed to check availability: ${e.message}", e)
        }
    }

    /**
     * 获取可用目标列表
     */
    @ReactMethod
    fun getAvailableTargets(type: String, promise: Promise) {
        try {
            val targets = callManager.getAvailableTargets(type)
            val array = Arguments.createArray()
            targets.forEach { array.pushString(it) }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("GET_TARGETS_ERROR", "Failed to get targets: ${e.message}", e)
        }
    }

    /**
     * 取消调用
     */
    @ReactMethod
    fun cancel(requestId: String?, promise: Promise) {
        try {
            callManager.cancel(requestId)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", "Failed to cancel: ${e.message}", e)
        }
    }

    /**
     * 解析 JSON 请求字符串
     */
    private fun parseRequest(requestJson: String): ExternalCallRequest {
        val json = JSONObject(requestJson)
        return ExternalCallRequest(
            requestId = if (json.has("requestId")) json.getString("requestId") else null,
            type = json.getString("type"),
            method = json.getString("method"),
            target = json.getString("target"),
            action = json.getString("action"),
            params = if (json.has("params")) {
                DataConverter.jsonObjectToReadableMap(json.getJSONObject("params"))
            } else {
                null
            },
            timeout = if (json.has("timeout")) json.getInt("timeout") else 30000,
            options = if (json.has("options")) {
                DataConverter.jsonObjectToReadableMap(json.getJSONObject("options"))
            } else {
                null
            }
        )
    }

    /**
     * 转换响应为 WritableMap
     */
    private fun convertResponseToWritableMap(
        response: com.impos2.turbomodules.external.models.ExternalCallResponse
    ): WritableMap {
        return Arguments.createMap().apply {
            response.requestId?.let { putString("requestId", it) }
            putInt("code", response.code)
            putBoolean("success", response.success)
            putString("message", response.message)

            response.data?.let { data ->
                when (val converted = DataConverter.convertToWritable(data)) {
                    is WritableMap -> putMap("data", converted)
                    is WritableArray -> putArray("data", converted)
                    is String -> putString("data", converted)
                    is Boolean -> putBoolean("data", converted)
                    is Int -> putInt("data", converted)
                    is Double -> putDouble("data", converted)
                    null -> putNull("data")
                }
            }

            response.raw?.let { raw ->
                when (val converted = DataConverter.convertToWritable(raw)) {
                    is WritableMap -> putMap("raw", converted)
                    is WritableArray -> putArray("raw", converted)
                    is String -> putString("raw", converted)
                    is Boolean -> putBoolean("raw", converted)
                    is Int -> putInt("raw", converted)
                    is Double -> putDouble("raw", converted)
                    null -> putNull("raw")
                }
            }

            putDouble("timestamp", response.timestamp.toDouble())
            putDouble("duration", response.duration.toDouble())
        }
    }
}
