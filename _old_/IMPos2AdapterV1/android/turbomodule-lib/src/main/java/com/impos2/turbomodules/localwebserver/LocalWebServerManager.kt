package com.impos2.turbomodules.localwebserver

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * LocalWebServer 管理器（单例模式）
 *
 * 设计目的:
 * 在多屏、多 JS 环境场景下，确保 Web 服务器只启动一次
 * 使用 Ktor 实现完整的 HTTP/WebSocket 服务器
 *
 * 职责:
 * 1. 管理 Web 服务器的启动和停止
 * 2. 管理设备连接（通过 DeviceConnectionManager）
 * 3. 提供统一的状态查询接口
 * 4. 确保线程安全和单例模式
 *
 * 优化点:
 * 1. 使用 Ktor 替代 NanoHTTPD,提供完整的 WebSocket 支持
 * 2. 分离关注点: KtorWebServer 负责网络层, DeviceConnectionManager 负责业务层
 * 3. 使用协程进行异步操作,避免阻塞主线程
 * 4. 完善的错误处理和状态管理
 */
class LocalWebServerManager private constructor(
    private val context: Context
) {

    companion object {
        private const val TAG = "LocalWebServerManager"
        private const val DEFAULT_PORT = 8888
        private const val DEFAULT_BASE_PATH = "/localServer"
        private const val DEFAULT_HEARTBEAT_INTERVAL = 30000L
        private const val DEFAULT_HEARTBEAT_TIMEOUT = 60000L

        @Volatile
        private var instance: LocalWebServerManager? = null

        /**
         * 获取单例实例
         */
        fun getInstance(context: Context): LocalWebServerManager {
            return instance ?: synchronized(this) {
                instance ?: LocalWebServerManager(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    // 服务器组件
    private var webServer: KtorWebServer? = null
    private var deviceManager: DeviceConnectionManager? = null

    // 服务器状态
    @Volatile
    private var serverStatus: String = "STOPPED"
    private var currentConfig: ServerConfig? = null
    private var serverAddresses: List<ServerAddress> = emptyList()
    private var lastError: String? = null

    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * 启动服务器
     */
    suspend fun startServer(
        port: Int = DEFAULT_PORT,
        basePath: String = DEFAULT_BASE_PATH,
        heartbeatInterval: Long = DEFAULT_HEARTBEAT_INTERVAL,
        heartbeatTimeout: Long = DEFAULT_HEARTBEAT_TIMEOUT
    ): ServerStatusInfo {
        return withContext(Dispatchers.IO) {
            try {
                // 如果服务器已经在运行，返回当前状态
                if (serverStatus == "RUNNING") {
                    Log.w(TAG, "服务器已经在运行中")
                    return@withContext getServerStatus()
                }

                Log.d(TAG, "开始启动服务器...")
                serverStatus = "STARTING"
                lastError = null

                // 创建配置
                val config = ServerConfig(
                    port = port,
                    basePath = basePath,
                    heartbeatInterval = heartbeatInterval,
                    heartbeatTimeout = heartbeatTimeout
                )
                currentConfig = config

                // 创建设备管理器
                deviceManager = DeviceConnectionManager(config)

                // 创建并启动 Web 服务器
                webServer = KtorWebServer(context, config, deviceManager!!)
                serverAddresses = webServer!!.start()

                serverStatus = "RUNNING"
                Log.d(TAG, "服务器启动成功，地址: $serverAddresses")

                getServerStatus()
            } catch (e: java.net.BindException) {
                // 端口占用的特殊处理
                Log.e(TAG, "端口已被占用", e)
                serverStatus = "ERROR"
                lastError = "端口 ${port} 已被占用，请尝试其他端口"
                cleanup()
                ServerStatusInfo(
                    status = serverStatus,
                    error = lastError
                )
            } catch (e: Exception) {
                Log.e(TAG, "启动服务器失败", e)
                serverStatus = "ERROR"
                lastError = e.message ?: "未知错误"

                // 清理资源
                cleanup()

                ServerStatusInfo(
                    status = serverStatus,
                    error = lastError
                )
            }
        }
    }

    /**
     * 停止服务器
     */
    suspend fun stopServer(): ServerStatusInfo {
        return withContext(Dispatchers.IO) {
            try {
                if (serverStatus == "STOPPED") {
                    Log.w(TAG, "服务器已经停止")
                    return@withContext getServerStatus()
                }

                Log.d(TAG, "开始停止服务器...")
                serverStatus = "STOPPING"

                // 停止 Web 服务器
                webServer?.stop()

                // 清理资源
                cleanup()

                serverStatus = "STOPPED"
                Log.d(TAG, "服务器已停止")

                getServerStatus()
            } catch (e: Exception) {
                Log.e(TAG, "停止服务器失败", e)
                serverStatus = "ERROR"
                lastError = e.message ?: "未知错误"

                ServerStatusInfo(
                    status = serverStatus,
                    error = lastError
                )
            }
        }
    }

    /**
     * 获取服务器状态
     */
    fun getServerStatus(): ServerStatusInfo {
        return ServerStatusInfo(
            status = serverStatus,
            addresses = serverAddresses,
            config = currentConfig,
            error = lastError
        )
    }

    /**
     * 获取服务器统计信息
     */
    fun getServerStats(): ServerStats? {
        return deviceManager?.getStats()
    }

    /**
     * 清理资源
     */
    private fun cleanup() {
        try {
            deviceManager?.close()
            deviceManager = null
            webServer = null
            serverAddresses = emptyList()
            currentConfig = null
        } catch (e: Exception) {
            Log.e(TAG, "清理资源失败", e)
        }
    }

    /**
     * 销毁管理器
     */
    fun destroy() {
        scope.launch {
            try {
                stopServer()
                scope.cancel()
            } catch (e: Exception) {
                Log.e(TAG, "销毁管理器失败", e)
            }
        }
    }
}
