package com.impos2.turbomodules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.*
import com.impos2.turbomodules.localwebserver.LocalWebServerService
import kotlinx.coroutines.*

/**
 * LocalWebServer TurboModule
 *
 * 优化点:
 * 1. 使用 Service 架构，支持 24/7 后台运行
 * 2. Service 被杀死后自动重启 (START_STICKY)
 * 3. 通过 Binder 与 Service 通信
 * 4. 提供完整的 LocalWebServer 接口
 * 5. 使用协程处理异步操作
 * 6. 完善的错误处理和日志记录
 */
class LocalWebServerTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LocalWebServerTurboModule"
        const val NAME = "LocalWebServerTurboModule"
    }

    private var localWebServerService: LocalWebServerService? = null
    private var isBound = false

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Service 连接回调
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.d(TAG, "Service 已连接")
            val binder = service as LocalWebServerService.LocalWebServerBinder
            localWebServerService = binder.getService()
            isBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Service 已断开")
            localWebServerService = null
            isBound = false
        }
    }

    init {
        // 启动并绑定 Service
        LocalWebServerService.startService(reactApplicationContext)
        bindService()
    }

    override fun getName(): String = NAME

    /**
     * 绑定 Service
     */
    private fun bindService() {
        val intent = Intent(reactApplicationContext, LocalWebServerService::class.java)
        reactApplicationContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    /**
     * 解绑 Service
     */
    private fun unbindService() {
        if (isBound) {
            reactApplicationContext.unbindService(serviceConnection)
            isBound = false
        }
    }

    /**
     * 启动 LocalWebServer
     */
    @ReactMethod
    fun startLocalWebServer(config: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                if (!isBound || localWebServerService == null) {
                    promise.reject("SERVICE_NOT_BOUND", "Service 未连接，请稍后重试")
                    return@launch
                }

                val port = if (config.hasKey("port")) config.getInt("port") else 8888
                val basePath = if (config.hasKey("basePath")) config.getString("basePath") ?: "/localServer" else "/localServer"
                val heartbeatInterval = if (config.hasKey("heartbeatInterval")) config.getInt("heartbeatInterval").toLong() else 30000L
                val heartbeatTimeout = if (config.hasKey("heartbeatTimeout")) config.getInt("heartbeatTimeout").toLong() else 60000L

                Log.d(TAG, "启动 LocalWebServer: port=$port, basePath=$basePath")

                val result = localWebServerService!!.startServer(
                    port = port,
                    basePath = basePath,
                    heartbeatInterval = heartbeatInterval,
                    heartbeatTimeout = heartbeatTimeout
                )

                val response = convertServerStatusToMap(result)
                promise.resolve(response)
            } catch (e: Exception) {
                Log.e(TAG, "startLocalWebServer 失败", e)
                promise.reject("START_SERVER_ERROR", e.message, e)
            }
        }
    }

    /**
     * 停止 LocalWebServer
     */
    @ReactMethod
    fun stopLocalWebServer(promise: Promise) {
        scope.launch {
            try {
                if (!isBound || localWebServerService == null) {
                    promise.reject("SERVICE_NOT_BOUND", "Service 未连接，请稍后重试")
                    return@launch
                }

                Log.d(TAG, "停止 LocalWebServer")
                val result = localWebServerService!!.stopServer()
                val response = convertServerStatusToMap(result)
                promise.resolve(response)
            } catch (e: Exception) {
                Log.e(TAG, "stopLocalWebServer 失败", e)
                promise.reject("STOP_SERVER_ERROR", e.message, e)
            }
        }
    }

    /**
     * 获取 LocalWebServer 状态
     */
    @ReactMethod
    fun getLocalWebServerStatus(promise: Promise) {
        scope.launch {
            try {
                if (!isBound || localWebServerService == null) {
                    promise.reject("SERVICE_NOT_BOUND", "Service 未连接，请稍后重试")
                    return@launch
                }

                val status = localWebServerService!!.getServerStatus()
                val response = convertServerStatusToMap(status)
                promise.resolve(response)
            } catch (e: Exception) {
                Log.e(TAG, "getLocalWebServerStatus 失败", e)
                promise.reject("GET_STATUS_ERROR", e.message, e)
            }
        }
    }

    /**
     * 获取 LocalWebServer 统计信息
     */
    @ReactMethod
    fun getLocalWebServerStats(promise: Promise) {
        scope.launch {
            try {
                if (!isBound || localWebServerService == null) {
                    promise.reject("SERVICE_NOT_BOUND", "Service 未连接，请稍后重试")
                    return@launch
                }

                val stats = localWebServerService!!.getServerStats()
                val response = Arguments.createMap().apply {
                    putInt("masterCount", stats.masterCount)
                    putInt("slaveCount", stats.slaveCount)
                    putInt("pendingCount", stats.pendingCount)
                    putDouble("uptime", stats.uptime.toDouble())
                }
                promise.resolve(response)
            } catch (e: Exception) {
                Log.e(TAG, "getLocalWebServerStats 失败", e)
                promise.reject("GET_STATS_ERROR", e.message, e)
            }
        }
    }

    /**
     * 转换 ServerStatusInfo 为 WritableMap
     */
    private fun convertServerStatusToMap(status: com.impos2.turbomodules.localwebserver.ServerStatusInfo): WritableMap {
        return Arguments.createMap().apply {
            putString("status", status.status)

            // 转换地址列表
            val addressesArray = Arguments.createArray()
            status.addresses.forEach { address ->
                val addressMap = Arguments.createMap().apply {
                    putString("name", address.name)
                    putString("address", address.address)
                }
                addressesArray.pushMap(addressMap)
            }
            putArray("addresses", addressesArray)

            // 转换配置
            if (status.config != null) {
                val configMap = Arguments.createMap().apply {
                    putInt("port", status.config.port)
                    putString("basePath", status.config.basePath)
                    putDouble("heartbeatInterval", status.config.heartbeatInterval.toDouble())
                    putDouble("heartbeatTimeout", status.config.heartbeatTimeout.toDouble())
                }
                putMap("config", configMap)
            } else {
                putNull("config")
            }

            // 错误信息
            if (status.error != null) {
                putString("error", status.error)
            } else {
                putNull("error")
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        unbindService()
        scope.cancel()
    }
}
