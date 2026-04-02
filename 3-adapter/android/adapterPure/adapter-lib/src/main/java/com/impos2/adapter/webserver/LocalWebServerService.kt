package com.impos2.adapter.webserver

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * LocalWebServer 后台 Service。
 *
 * 真正的 WebServer 生命周期、前台通知、自动恢复、连接管理都在这里汇总。
 * 之所以落到 Service，而不是直接放在 manager 内存对象里，是因为业务要求本地服务在宿主页面
 * 波动时也尽量保持稳定，不依赖单个 Activity 生命周期。
 *
 * 当前职责：
 * - 承载 [LocalWebServer] 实例；
 * - 维护前台服务通知；
 * - 记录启动/停止/自动恢复等运行态统计；
 * - 在 stop 或异常恢复时清理 runtime 资源。
 */
class LocalWebServerService : Service() {

    enum class ServiceState {
        STOPPED,
        STARTING,
        RUNNING,
        STOPPING,
        ERROR,
    }

    companion object {
        private const val TAG = "LocalWebServerService"
        private const val NOTIFICATION_ID = 2001
        private const val CHANNEL_ID = "lws_channel"
        private const val PREFS = "lws_prefs"

        fun start(context: Context) {
            val intent = Intent(context, LocalWebServerService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(intent)
            else
                context.startService(intent)
        }

        fun stop(context: Context) = context.stopService(Intent(context, LocalWebServerService::class.java))
    }

    inner class LwsBinder : Binder() { fun get() = this@LocalWebServerService }

    private val binder = LwsBinder()
    // 所有延迟恢复与异步状态维护都集中到单线程调度器，降低竞态复杂度。
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var heartbeatFuture: ScheduledFuture<*>? = null
    private var cleanupFuture: ScheduledFuture<*>? = null

    private var server: LocalWebServer? = null
    private var deviceManager: DeviceConnectionManager? = null
    var config: ServerConfig = ServerConfig()

    @Volatile var state: ServiceState = ServiceState.STOPPED
    @Volatile var addresses: List<Pair<String, String>> = emptyList()
    @Volatile var lastError: String? = null
    @Volatile var lastErrorAt: Long = 0L
    @Volatile var lastStartedAt: Long = 0L
    @Volatile var lastStoppedAt: Long = 0L

    private val startCount = AtomicInteger(0)
    private val stopCount = AtomicInteger(0)
    private val bindCount = AtomicInteger(0)
    private val autoRecoverCount = AtomicInteger(0)
    private val notificationUpdateCount = AtomicInteger(0)
    private val lastStatusChangeAt = AtomicLong(System.currentTimeMillis())

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("等待启动..."))
    }

    override fun onBind(intent: Intent): IBinder {
        bindCount.incrementAndGet()
        return binder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean("autoStart", false)) {
            autoRecoverCount.incrementAndGet()
            val cfg = ServerConfig(
                port = prefs.getInt("port", 8888),
                basePath = prefs.getString("basePath", "/localServer")!!,
                heartbeatInterval = prefs.getLong("heartbeatInterval", 30_000L),
                defaultRuntimeConfig = RuntimeConfig(
                    heartbeatTimeout = prefs.getLong("heartbeatTimeout", 60_000L),
                    retryCacheTimeout = prefs.getLong("retryCacheTimeout", 30_000L),
                ),
            )
            scheduler.submit { startServer(cfg) }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopServer()
        scheduler.shutdownNow()
        super.onDestroy()
    }

    @Synchronized
    fun startServer(cfg: ServerConfig): String? {
        when (state) {
            ServiceState.RUNNING -> {
                Log.i(TAG, "startServer ignored: already running")
                return null
            }
            ServiceState.STARTING -> {
                Log.i(TAG, "startServer ignored: server is starting")
                return null
            }
            ServiceState.STOPPING -> {
                val message = "server is stopping"
                recordError(message)
                Log.w(TAG, "startServer rejected: $message")
                return message
            }
            ServiceState.STOPPED, ServiceState.ERROR -> Unit
        }

        updateState(ServiceState.STARTING)
        clearError()
        return try {
            cancelTimers()
            stopRuntime(clearPrefs = false)
            config = cfg
            val dm = DeviceConnectionManager(cfg)
            val srv = LocalWebServer(cfg, dm)
            srv.start()
            deviceManager = dm
            server = srv
            addresses = srv.getAddresses()
            lastStartedAt = System.currentTimeMillis()
            startCount.incrementAndGet()
            updateState(ServiceState.RUNNING)
            scheduleTimers(cfg)
            savePrefs(cfg)
            updateNotification("运行中 :${cfg.port}")
            Log.i(TAG, "startServer success: port=${cfg.port}, basePath=${cfg.basePath}")
            null
        } catch (e: Exception) {
            stopRuntime(clearPrefs = false)
            updateState(ServiceState.ERROR)
            recordError(e.message ?: "start failed")
            Log.e(TAG, "start failed", e)
            e.message ?: "start failed"
        }
    }

    @Synchronized
    fun stopServer() {
        when (state) {
            ServiceState.STOPPED -> {
                cancelTimers()
                stopRuntime(clearPrefs = true)
                clearError()
                lastStoppedAt = System.currentTimeMillis()
                updateNotification("已停止")
                Log.i(TAG, "stopServer ignored: already stopped")
                return
            }
            ServiceState.STOPPING -> {
                Log.i(TAG, "stopServer ignored: server is stopping")
                return
            }
            ServiceState.STARTING, ServiceState.RUNNING, ServiceState.ERROR -> Unit
        }

        updateState(ServiceState.STOPPING)
        try {
            cancelTimers()
            stopRuntime(clearPrefs = true)
            clearError()
            lastStoppedAt = System.currentTimeMillis()
            stopCount.incrementAndGet()
            updateState(ServiceState.STOPPED)
            updateNotification("已停止")
            Log.i(TAG, "stopServer success")
        } catch (e: Exception) {
            updateState(ServiceState.ERROR)
            recordError(e.message ?: "stop failed")
            Log.e(TAG, "stopServer failed", e)
            updateNotification("停止异常")
        }
    }

    fun getStats(): com.impos2.adapter.interfaces.ServerStats {
        val base = deviceManager?.getStats() ?: DeviceConnectionStats(0, 0, 0, 0)
        return com.impos2.adapter.interfaces.ServerStats(
            masterCount = base.masterCount,
            slaveCount = base.slaveCount,
            pendingCount = base.pendingCount,
            uptime = base.uptime,
            requestCount = server?.getRequestCount() ?: 0L,
        )
    }

    fun dumpState(): String {
        val snapshot = server?.getDiagnosticsSnapshot().orEmpty()
        return buildString {
            append("state=")
            append(state)
            append(", addresses=")
            append(addresses.size)
            append(", lastError=")
            append(lastError ?: "null")
            append(", lastErrorAt=")
            append(lastErrorAt)
            append(", lastStartedAt=")
            append(lastStartedAt)
            append(", lastStoppedAt=")
            append(lastStoppedAt)
            append(", statusChangedAt=")
            append(lastStatusChangeAt.get())
            append(", starts=")
            append(startCount.get())
            append(", stops=")
            append(stopCount.get())
            append(", binds=")
            append(bindCount.get())
            append(", autoRecover=")
            append(autoRecoverCount.get())
            append(", notifications=")
            append(notificationUpdateCount.get())
            append(", server=")
            append(snapshot)
        }
    }

    private fun scheduleTimers(cfg: ServerConfig) {
        cancelTimers()
        heartbeatFuture = scheduler.scheduleAtFixedRate({
            try {
                server?.sendHeartbeat()
                server?.checkHeartbeatTimeouts()
                server?.checkRetryQueueTimeouts()
            } catch (e: Exception) {
                recordError(e.message ?: "heartbeat task failed")
                Log.e(TAG, "heartbeat task failed", e)
            }
        }, cfg.heartbeatInterval, cfg.heartbeatInterval, TimeUnit.MILLISECONDS)

        cleanupFuture = scheduler.scheduleAtFixedRate({
            try {
                deviceManager?.cleanExpiredPending()
            } catch (e: Exception) {
                recordError(e.message ?: "cleanup task failed")
                Log.e(TAG, "cleanup task failed", e)
            }
        }, 60, 60, TimeUnit.SECONDS)
    }

    private fun cancelTimers() {
        heartbeatFuture?.cancel(false)
        heartbeatFuture = null
        cleanupFuture?.cancel(false)
        cleanupFuture = null
    }

    private fun stopRuntime(clearPrefs: Boolean) {
        try {
            server?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "stopRuntime server.stop failed", e)
            recordError(e.message ?: "server stop failed")
        } finally {
            server = null
        }

        deviceManager = null
        addresses = emptyList()
        if (clearPrefs) {
            clearPrefs()
        }
    }

    private fun updateState(next: ServiceState) {
        state = next
        lastStatusChangeAt.set(System.currentTimeMillis())
    }

    private fun recordError(message: String) {
        lastError = message
        lastErrorAt = System.currentTimeMillis()
    }

    private fun clearError() {
        lastError = null
        lastErrorAt = 0L
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "本地服务器", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification =
        Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("LocalWebServer")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        notificationUpdateCount.incrementAndGet()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun savePrefs(cfg: ServerConfig) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            putBoolean("autoStart", true)
            putInt("port", cfg.port)
            putString("basePath", cfg.basePath)
            putLong("heartbeatInterval", cfg.heartbeatInterval)
            putLong("heartbeatTimeout", cfg.defaultRuntimeConfig.heartbeatTimeout)
            putLong("retryCacheTimeout", cfg.defaultRuntimeConfig.retryCacheTimeout)
            apply()
        }
    }

    private fun clearPrefs() {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
