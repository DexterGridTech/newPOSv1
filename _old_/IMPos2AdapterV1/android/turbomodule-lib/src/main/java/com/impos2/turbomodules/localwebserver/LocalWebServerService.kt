package com.impos2.turbomodules.localwebserver

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

/**
 * LocalWebServer 前台服务
 *
 * 功能:
 * 1. 在独立的 Service 中运行 LocalWebServer
 * 2. 使用前台服务保持运行,不易被系统回收
 * 3. 支持自动重启机制
 * 4. 提供 Binder 接口供 TurboModule 调用
 *
 * 优化点:
 * 1. START_STICKY: 被杀死后自动重启
 * 2. 前台服务: 提高优先级,不易被回收
 * 3. WakeLock: 保持 CPU 运行 (可选)
 * 4. 完善的生命周期管理
 */
class LocalWebServerService : Service() {

    companion object {
        private const val TAG = "LocalWebServerService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "local_web_server_channel"
        private const val CHANNEL_NAME = "LocalWebServer 服务"
        private const val PREFS_NAME = "local_web_server_prefs"
        private const val KEY_AUTO_START = "auto_start"
        private const val KEY_PORT = "port"
        private const val KEY_BASE_PATH = "base_path"
        private const val KEY_HEARTBEAT_INTERVAL = "heartbeat_interval"
        private const val KEY_HEARTBEAT_TIMEOUT = "heartbeat_timeout"

        // Service 状态
        @Volatile
        private var isServiceRunning = false

        /**
         * 启动服务
         */
        fun startService(context: Context) {
            val intent = Intent(context, LocalWebServerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * 停止服务
         */
        fun stopService(context: Context) {
            val intent = Intent(context, LocalWebServerService::class.java)
            context.stopService(intent)
        }

        /**
         * 检查服务是否运行
         */
        fun isRunning(): Boolean = isServiceRunning
    }

    // Binder 用于与 TurboModule 通信
    private val binder = LocalWebServerBinder()

    // LocalWebServerManager 实例
    private lateinit var serverManager: LocalWebServerManager

    // 协程作用域
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * Binder 类
     */
    inner class LocalWebServerBinder : Binder() {
        fun getService(): LocalWebServerService = this@LocalWebServerService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate")

        // 初始化 ServerManager
        serverManager = LocalWebServerManager.getInstance(applicationContext)

        // 创建通知渠道
        createNotificationChannel()

        // 启动前台服务
        startForeground(NOTIFICATION_ID, createNotification("服务已启动", "等待启动服务器..."))

        isServiceRunning = true
    }

    override fun onBind(intent: Intent): IBinder {
        Log.d(TAG, "Service onBind")
        return binder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service onStartCommand")

        // 检查是否需要自动恢复服务器
        serviceScope.launch {
            tryRestoreServer()
        }

        return START_STICKY // 被杀死后自动重启
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service onDestroy")

        // 同步停止服务器，确保资源正确释放
        runBlocking {
            try {
                serverManager.stopServer()
                Log.d(TAG, "服务器已停止")
            } catch (e: Exception) {
                Log.e(TAG, "停止服务器失败", e)
            }
        }

        // 取消协程
        serviceScope.cancel()

        isServiceRunning = false
    }

    /**
     * 启动服务器
     */
    suspend fun startServer(
        port: Int,
        basePath: String,
        heartbeatInterval: Long,
        heartbeatTimeout: Long
    ): ServerStatusInfo {
        return withContext(Dispatchers.IO) {
            try {
                val result = serverManager.startServer(port, basePath, heartbeatInterval, heartbeatTimeout)

                // 更新通知
                if (result.status == "RUNNING") {
                    updateNotification("服务器运行中", "端口: $port")
                    // 保存配置，用于自动恢复
                    saveServerConfig(port, basePath, heartbeatInterval, heartbeatTimeout)
                }

                result
            } catch (e: Exception) {
                Log.e(TAG, "启动服务器失败", e)
                throw e
            }
        }
    }

    /**
     * 停止服务器
     */
    suspend fun stopServer(): ServerStatusInfo {
        return withContext(Dispatchers.IO) {
            try {
                val result = serverManager.stopServer()
                updateNotification("服务器已停止", "等待启动...")
                // 清除自动启动标记
                clearServerConfig()
                result
            } catch (e: Exception) {
                Log.e(TAG, "停止服务器失败", e)
                throw e
            }
        }
    }

    /**
     * 获取服务器状态
     */
    suspend fun getServerStatus(): ServerStatusInfo {
        return withContext(Dispatchers.IO) {
            serverManager.getServerStatus()
        }
    }

    /**
     * 获取服务器统计信息
     */
    suspend fun getServerStats(): ServerStats {
        return withContext(Dispatchers.IO) {
            serverManager.getServerStats() ?: ServerStats(
                masterCount = 0,
                slaveCount = 0,
                pendingCount = 0,
                uptime = 0L
            )
        }
    }

    /**
     * 尝试恢复服务器 (Service 重启后自动调用)
     */
    private suspend fun tryRestoreServer() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val autoStart = prefs.getBoolean(KEY_AUTO_START, false)

        if (autoStart) {
            val port = prefs.getInt(KEY_PORT, 8888)
            val basePath = prefs.getString(KEY_BASE_PATH, "/localServer") ?: "/localServer"
            val heartbeatInterval = prefs.getLong(KEY_HEARTBEAT_INTERVAL, 30000L)
            val heartbeatTimeout = prefs.getLong(KEY_HEARTBEAT_TIMEOUT, 60000L)

            Log.d(TAG, "检测到自动启动配置，正在恢复服务器: port=$port")

            try {
                startServer(port, basePath, heartbeatInterval, heartbeatTimeout)
                Log.d(TAG, "服务器自动恢复成功")
            } catch (e: Exception) {
                Log.e(TAG, "服务器自动恢复失败", e)
                updateNotification("服务器恢复失败", e.message ?: "未知错误")
            }
        }
    }

    /**
     * 创建通知渠道 (Android 8.0+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "LocalWebServer 后台服务通知"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 创建通知
     */
    private fun createNotification(title: String, content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true) // 不可滑动删除
            .setAutoCancel(false)
            .build()
    }

    /**
     * 更新通知
     */
    private fun updateNotification(title: String, content: String) {
        val notification = createNotification(title, content)
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * 保存服务器配置
     */
    private fun saveServerConfig(port: Int, basePath: String, heartbeatInterval: Long, heartbeatTimeout: Long) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_AUTO_START, true)
            putInt(KEY_PORT, port)
            putString(KEY_BASE_PATH, basePath)
            putLong(KEY_HEARTBEAT_INTERVAL, heartbeatInterval)
            putLong(KEY_HEARTBEAT_TIMEOUT, heartbeatTimeout)
            apply()
        }
        Log.d(TAG, "服务器配置已保存")
    }

    /**
     * 清除服务器配置
     */
    private fun clearServerConfig() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        Log.d(TAG, "服务器配置已清除")
    }
}
