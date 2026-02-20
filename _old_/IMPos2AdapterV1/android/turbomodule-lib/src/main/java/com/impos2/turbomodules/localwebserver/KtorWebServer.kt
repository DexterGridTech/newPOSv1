package com.impos2.turbomodules.localwebserver

import android.content.Context
import android.util.Log
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.Inet4Address
import java.net.NetworkInterface
import java.time.Duration

/**
 * Ktor Web 服务器
 *
 * 负责启动和管理 HTTP/WebSocket 服务器
 *
 * 优化点:
 * 1. 使用 Netty 作为底层引擎,性能优异
 * 2. 完整的 WebSocket 支持,包括心跳检测
 * 3. 自动获取所有网络接口地址
 * 4. 完善的错误处理和日志记录
 */
class KtorWebServer(
    private val context: Context,
    private val config: ServerConfig,
    private val deviceManager: DeviceConnectionManager
) {
    companion object {
        private const val TAG = "KtorWebServer"
    }

    private var server: NettyApplicationEngine? = null
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * 启动服务器
     */
    suspend fun start(): List<ServerAddress> {
        try {
            Log.d(TAG, "正在启动服务器，端口: ${config.port}")

            server = embeddedServer(Netty, port = config.port) {
                configureServer()
            }

            server?.start(wait = false)
            Log.d(TAG, "服务器启动成功")

            // 获取所有网络地址
            return getAllNetworkAddresses()
        } catch (e: Exception) {
            Log.e(TAG, "服务器启动失败", e)
            throw e
        }
    }

    /**
     * 配置服务器
     */
    private fun Application.configureServer() {
        // 配置 JSON 序列化
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = true
                isLenient = true
                ignoreUnknownKeys = true
            })
        }

        // 配置 CORS
        install(CORS) {
            anyHost()
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Options)
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
        }

        // 配置 WebSocket
        install(WebSockets) {
            pingPeriod = Duration.ofSeconds(30)
            timeout = Duration.ofSeconds(60)
            maxFrameSize = Long.MAX_VALUE
            masking = false
        }

        // 配置路由
        routing {
            configureRoutes()
        }
    }

    /**
     * 配置路由
     */
    private fun Routing.configureRoutes() {
        // 设备注册接口
        post("${config.basePath}/register") {
            try {
                val registration = call.receive<DeviceRegistration>()
                val response = deviceManager.preRegisterDevice(registration)
                call.respond(response)
            } catch (e: Exception) {
                Log.e(TAG, "注册失败", e)
                call.respond(HttpStatusCode.BadRequest, RegistrationResponse(
                    success = false,
                    error = "注册失败: ${e.message}"
                ))
            }
        }

        // 健康检查接口
        get("${config.basePath}/health") {
            call.respond(mapOf(
                "status" to "ok",
                "uptime" to deviceManager.getStats().uptime,
                "timestamp" to System.currentTimeMillis()
            ))
        }

        // 统计信息接口
        get("${config.basePath}/stats") {
            call.respond(deviceManager.getStats())
        }

        // WebSocket 连接
        webSocket("${config.basePath}/ws") {
            handleWebSocketConnection(this)
        }
    }

    /**
     * 处理 WebSocket 连接
     */
    private suspend fun handleWebSocketConnection(session: DefaultWebSocketServerSession) {
        var deviceName: String? = null

        try {
            // 1. 等待客户端发送 token (5秒超时)
            val tokenFrame = withTimeoutOrNull(5000) {
                session.incoming.receive() as? Frame.Text
            }

            if (tokenFrame == null) {
                session.close(CloseReason(CloseReason.Codes.PROTOCOL_ERROR, "未收到 token 或超时"))
                return
            }

            val token = tokenFrame.readText()
            Log.d(TAG, "收到 WebSocket 连接请求，token: $token")

            // 2. 验证 token 并建立连接
            if (!deviceManager.connectDeviceWithToken(token, session)) {
                session.close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "无效的 token"))
                return
            }

            // 3. 获取设备名称（从 deviceManager 的连接信息中）
            deviceName = getDeviceNameFromSession(session)
            if (deviceName == null) {
                session.close(CloseReason(CloseReason.Codes.INTERNAL_ERROR, "无法获取设备名称"))
                return
            }

            Log.d(TAG, "设备连接成功: $deviceName")

            // 4. 处理消息循环
            for (frame in session.incoming) {
                try {
                    when (frame) {
                        is Frame.Text -> {
                            val text = frame.readText()
                            handleMessage(text, deviceName)
                        }
                        is Frame.Close -> {
                            Log.d(TAG, "设备主动断开连接: $deviceName")
                            break
                        }
                        else -> {
                            // 忽略其他类型的帧
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "处理消息帧失败: $deviceName", e)
                    // 继续处理下一个消息,不中断连接
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "WebSocket 连接异常", e)
        } finally {
            // 5. 清理连接
            if (deviceName != null) {
                deviceManager.disconnectDevice(deviceName)
            }
        }
    }

    /**
     * 从 session 获取设备名称
     */
    private fun getDeviceNameFromSession(session: WebSocketSession): String? {
        // 从 deviceManager 中查找对应的设备名称
        return deviceManager.getDeviceNameBySession(session)
    }

    /**
     * 处理接收到的消息
     */
    private suspend fun handleMessage(text: String, deviceName: String) {
        try {
            val json = Json.parseToJsonElement(text).jsonObject
            val type = json["type"]?.jsonPrimitive?.content

            // 处理心跳确认
            if (type == SystemMessageTypes.HEARTBEAT_ACK) {
                deviceManager.updateHeartbeat(deviceName)
                return
            }

            // 解析消息
            val message = Json.decodeFromString<MessageWrapper>(text)

            // 路由消息
            deviceManager.routeMessage(message, deviceName)

            Log.d(TAG, "消息已路由: from=$deviceName, type=${message.type}")
        } catch (e: Exception) {
            Log.e(TAG, "处理消息失败", e)
        }
    }

    /**
     * 获取所有网络地址
     */
    private fun getAllNetworkAddresses(): List<ServerAddress> {
        val addresses = mutableListOf<ServerAddress>()

        try {
            Log.d(TAG, "开始获取网络地址")
            val interfaces = NetworkInterface.getNetworkInterfaces()
            var interfaceCount = 0

            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                interfaceCount++

                Log.d(TAG, "检查网络接口 #$interfaceCount: ${networkInterface.displayName}")
                Log.d(TAG, "  - isUp: ${networkInterface.isUp}")
                Log.d(TAG, "  - isLoopback: ${networkInterface.isLoopback}")

                // 跳过未启用的接口
                if (!networkInterface.isUp || networkInterface.isLoopback) {
                    Log.d(TAG, "  - 跳过此接口")
                    continue
                }

                val inetAddresses = networkInterface.inetAddresses
                var addressCount = 0

                while (inetAddresses.hasMoreElements()) {
                    val inetAddress = inetAddresses.nextElement()
                    addressCount++

                    Log.d(TAG, "  - 地址 #$addressCount: ${inetAddress.hostAddress}, 类型: ${inetAddress.javaClass.simpleName}")

                    // 只处理 IPv4 地址
                    if (inetAddress is Inet4Address) {
                        val address = ServerAddress(
                            name = networkInterface.displayName,
                            address = "http://${inetAddress.hostAddress}:${config.port}${config.basePath}"
                        )
                        addresses.add(address)
                        Log.d(TAG, "✓ 发现 IPv4 地址: ${address.address}")
                    }
                }
            }

            Log.d(TAG, "网络地址获取完成，共找到 ${addresses.size} 个地址")
        } catch (e: Exception) {
            Log.e(TAG, "获取网络地址失败", e)
        }

        // 如果没有找到任何地址，添加 localhost 作为默认地址
        if (addresses.isEmpty()) {
            Log.d(TAG, "未找到网络地址，添加 localhost 作为默认地址")
            addresses.add(
                ServerAddress(
                    name = "localhost",
                    address = "http://localhost:${config.port}${config.basePath}"
                )
            )
        }

        Log.d(TAG, "准备返回地址列表，共 ${addresses.size} 个地址")
        return addresses
    }

    /**
     * 停止服务器
     */
    suspend fun stop() = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "正在停止服务器")
            server?.stop(1000, 2000)
            server = null
            scope.cancel()
            Log.d(TAG, "服务器已停止")
        } catch (e: Exception) {
            Log.e(TAG, "停止服务器失败", e)
            throw e
        }
    }

    /**
     * 检查服务器是否运行中
     */
    fun isRunning(): Boolean {
        return server != null
    }

    /**
     * 获取服务器地址列表
     */
    fun getServerAddresses(): List<ServerAddress> {
        return if (isRunning()) {
            getAllNetworkAddresses()
        } else {
            emptyList()
        }
    }
}
