package com.impos2.posadapterrn84.turbomodules

import com.impos2.posadapterrn84.NativeLoggerTurboModuleSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.impos2.posadapterrn84.turbomodules.logger.LogManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class LoggerTurboModule(reactContext: ReactApplicationContext) :
    NativeLoggerTurboModuleSpec(reactContext) {

    companion object {
        private const val DATE_FORMAT = "yyyy-MM-dd"
        private const val MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024L // 10MB

        private val dateFormatThreadLocal = ThreadLocal.withInitial {
            SimpleDateFormat(DATE_FORMAT, Locale.getDefault())
        }
    }

    private val logManager by lazy { LogManager.getInstance(reactApplicationContext) }
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun debug(tag: String, message: String) {
        logManager.debug(tag, message)
    }

    override fun log(tag: String, message: String) {
        logManager.log(tag, message)
    }

    override fun warn(tag: String, message: String) {
        logManager.warn(tag, message)
    }

    override fun error(tag: String, message: String) {
        logManager.error(tag, message)
    }

    override fun getLogFiles(promise: Promise) {
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
        } catch (e: Exception) {
            promise.reject("GET_LOG_FILES_ERROR", e.message, e)
        }
    }

    override fun getLogContent(fileName: String, promise: Promise) {
        try {
            // 使用与上传相同的大小限制
            promise.resolve(logManager.getLogContent(fileName, MAX_UPLOAD_FILE_SIZE))
        } catch (e: Exception) {
            promise.reject("GET_LOG_CONTENT_ERROR", e.message, e)
        }
    }

    override fun deleteLogFile(fileName: String, promise: Promise) {
        try {
            promise.resolve(logManager.deleteLogFile(fileName))
        } catch (e: Exception) {
            promise.reject("DELETE_LOG_FILE_ERROR", e.message, e)
        }
    }

    override fun clearAllLogs(promise: Promise) {
        try {
            promise.resolve(logManager.clearAllLogs())
        } catch (e: Exception) {
            promise.reject("CLEAR_ALL_LOGS_ERROR", e.message, e)
        }
    }

    override fun getLogDirPath(promise: Promise) {
        try {
            promise.resolve(logManager.getLogDirPath())
        } catch (e: Exception) {
            promise.reject("GET_LOG_DIR_PATH_ERROR", e.message, e)
        }
    }

    override fun sendLogFileToServer(dateStr: String, serverURL: String, paramsJson: String, promise: Promise) {
        scope.launch {
            try {
                // Parse date
                val dateFormat = dateFormatThreadLocal.get()!!
                val date = dateFormat.parse(dateStr)
                    ?: throw IllegalArgumentException("Invalid date format: $dateStr")

                // Get log file
                val logFile = logManager.getLogFileByDate(date)
                    ?: throw IllegalArgumentException("Log file not found for date: $dateStr")

                // Check file size
                val fileSize = logFile.length()
                if (fileSize > MAX_UPLOAD_FILE_SIZE) {
                    throw IllegalArgumentException(
                        "Log file too large: ${fileSize / 1024 / 1024}MB (max: ${MAX_UPLOAD_FILE_SIZE / 1024 / 1024}MB)"
                    )
                }

                // Parse params
                val params = try {
                    JSONObject(paramsJson)
                } catch (e: Exception) {
                    JSONObject()
                }

                // Read log content with size limit
                val logContent = withContext(Dispatchers.IO) {
                    logManager.getLogContent(logFile.name, MAX_UPLOAD_FILE_SIZE)
                }.also { content ->
                    if (content.isEmpty()) {
                        throw IllegalStateException("Log file is empty or was deleted: ${logFile.name}")
                    }
                }

                // Prepare request body
                val requestBody = JSONObject().apply {
                    put("date", dateStr)
                    put("fileName", logFile.name)
                    put("fileSize", fileSize)
                    put("content", logContent)
                    // Merge additional params
                    params.keys().forEach { key ->
                        put(key, params.get(key))
                    }
                }

                // Send HTTP POST request
                val success = withContext(Dispatchers.IO) {
                    val url = URL(serverURL)
                    val connection = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        setRequestProperty("Accept", "application/json")
                        setRequestProperty("User-Agent", "POS-Adapter-Android/1.0")
                        connectTimeout = 30000
                        readTimeout = 30000
                    }

                    try {
                        connection.outputStream.use { os ->
                            os.write(requestBody.toString().toByteArray(Charsets.UTF_8))
                            os.flush()
                        }

                        val responseCode = connection.responseCode
                        if (responseCode in 200..299) {
                            true
                        } else {
                            val errorBody = connection.errorStream
                                ?.bufferedReader()
                                ?.use { reader ->
                                    val buffer = CharArray(1024)
                                    val read = reader.read(buffer)
                                    if (read > 0) String(buffer, 0, read) else ""
                                } ?: ""
                            throw Exception("Server returned error code: $responseCode, body: $errorBody")
                        }
                    } finally {
                        connection.disconnect()
                    }
                }

                promise.resolve(success)
            } catch (e: Exception) {
                promise.reject("SEND_LOG_FILE_ERROR", e.message, e)
            }
        }
    }
}
