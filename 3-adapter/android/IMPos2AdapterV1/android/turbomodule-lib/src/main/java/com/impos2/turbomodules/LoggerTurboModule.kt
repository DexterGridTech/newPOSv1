package com.impos2.turbomodules

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.impos2.turbomodules.logger.LogManager

/**
 * Logger TurboModule
 *
 * 优化点:
 * 1. 使用单例 LogManager，支持多 ReactInstanceManager 场景
 * 2. 提供完整的日志管理接口
 * 3. 统一的错误处理
 */
class LoggerTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LoggerTurboModule"
        const val NAME = "LoggerTurboModule"
    }

    private val logManager: LogManager by lazy {
        LogManager.getInstance(reactApplicationContext)
    }

    override fun getName(): String = NAME

    /**
     * 写入 DEBUG 级别日志
     */
    @ReactMethod
    fun debug(tag: String, message: String) {
        try {
            logManager.debug(tag, message)
        } catch (e: Exception) {
            Log.e(TAG, "debug 失败", e)
        }
    }

    /**
     * 写入 INFO 级别日志
     */
    @ReactMethod
    fun log(tag: String, message: String) {
        try {
            logManager.log(tag, message)
        } catch (e: Exception) {
            Log.e(TAG, "log 失败", e)
        }
    }

    /**
     * 写入 WARN 级别日志
     */
    @ReactMethod
    fun warn(tag: String, message: String) {
        try {
            logManager.warn(tag, message)
        } catch (e: Exception) {
            Log.e(TAG, "warn 失败", e)
        }
    }

    /**
     * 写入 ERROR 级别日志
     */
    @ReactMethod
    fun error(tag: String, message: String) {
        try {
            logManager.error(tag, message)
        } catch (e: Exception) {
            Log.e(TAG, "error 失败", e)
        }
    }

    /**
     * 获取所有日志文件列表
     */
    @ReactMethod
    fun getLogFiles(promise: Promise) {
        try {
            val files = logManager.getLogFiles()
            val result = WritableNativeArray()

            files.forEach { fileMap ->
                val map = WritableNativeMap()
                map.putString("name", fileMap["name"] as String)
                map.putString("path", fileMap["path"] as String)
                map.putDouble("size", (fileMap["size"] as Long).toDouble())
                map.putDouble("lastModified", (fileMap["lastModified"] as Long).toDouble())
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "getLogFiles 失败", e)
            promise.reject("GET_LOG_FILES_ERROR", e.message, e)
        }
    }

    /**
     * 读取指定日志文件内容
     */
    @ReactMethod
    fun getLogContent(fileName: String, promise: Promise) {
        try {
            val content = logManager.getLogContent(fileName)
            promise.resolve(content)
        } catch (e: Exception) {
            Log.e(TAG, "getLogContent 失败", e)
            promise.reject("GET_LOG_CONTENT_ERROR", e.message, e)
        }
    }

    /**
     * 删除指定日志文件
     */
    @ReactMethod
    fun deleteLogFile(fileName: String, promise: Promise) {
        try {
            val success = logManager.deleteLogFile(fileName)
            promise.resolve(success)
        } catch (e: Exception) {
            Log.e(TAG, "deleteLogFile 失败", e)
            promise.reject("DELETE_LOG_FILE_ERROR", e.message, e)
        }
    }

    /**
     * 清空所有日志文件
     */
    @ReactMethod
    fun clearAllLogs(promise: Promise) {
        try {
            val success = logManager.clearAllLogs()
            promise.resolve(success)
        } catch (e: Exception) {
            Log.e(TAG, "clearAllLogs 失败", e)
            promise.reject("CLEAR_ALL_LOGS_ERROR", e.message, e)
        }
    }

    /**
     * 获取日志目录路径
     */
    @ReactMethod
    fun getLogDirPath(promise: Promise) {
        try {
            val path = logManager.getLogDirPath()
            promise.resolve(path)
        } catch (e: Exception) {
            Log.e(TAG, "getLogDirPath 失败", e)
            promise.reject("GET_LOG_DIR_PATH_ERROR", e.message, e)
        }
    }
}
