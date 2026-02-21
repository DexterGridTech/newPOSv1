package com.impos2.posadapter.turbomodules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.impos2.posadapter.turbomodules.logger.LogManager

class LoggerTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "LoggerTurboModule"
    }

    private val logManager by lazy { LogManager.getInstance(reactApplicationContext) }

    override fun getName() = NAME

    @ReactMethod fun debug(tag: String, message: String) { logManager.debug(tag, message) }
    @ReactMethod fun log(tag: String, message: String) { logManager.log(tag, message) }
    @ReactMethod fun warn(tag: String, message: String) { logManager.warn(tag, message) }
    @ReactMethod fun error(tag: String, message: String) { logManager.error(tag, message) }

    @ReactMethod
    fun getLogFiles(promise: Promise) {
        try {
            val result = WritableNativeArray()
            logManager.getLogFiles().forEach { f ->
                WritableNativeMap().apply {
                    putString("fileName", f["fileName"] as String)
                    putString("filePath", f["filePath"] as String)
                    putDouble("fileSize", (f["fileSize"] as Long).toDouble())
                    putDouble("lastModified", (f["lastModified"] as Long).toDouble())
                }.also { result.pushMap(it) }
            }
            promise.resolve(result)
        } catch (e: Exception) { promise.reject("GET_LOG_FILES_ERROR", e.message, e) }
    }

    @ReactMethod
    fun getLogContent(fileName: String, promise: Promise) {
        try { promise.resolve(logManager.getLogContent(fileName)) }
        catch (e: Exception) { promise.reject("GET_LOG_CONTENT_ERROR", e.message, e) }
    }

    @ReactMethod
    fun deleteLogFile(fileName: String, promise: Promise) {
        try { promise.resolve(logManager.deleteLogFile(fileName)) }
        catch (e: Exception) { promise.reject("DELETE_LOG_FILE_ERROR", e.message, e) }
    }

    @ReactMethod
    fun clearAllLogs(promise: Promise) {
        try { promise.resolve(logManager.clearAllLogs()) }
        catch (e: Exception) { promise.reject("CLEAR_ALL_LOGS_ERROR", e.message, e) }
    }

    @ReactMethod
    fun getLogDirPath(promise: Promise) {
        try { promise.resolve(logManager.getLogDirPath()) }
        catch (e: Exception) { promise.reject("GET_LOG_DIR_PATH_ERROR", e.message, e) }
    }
}
