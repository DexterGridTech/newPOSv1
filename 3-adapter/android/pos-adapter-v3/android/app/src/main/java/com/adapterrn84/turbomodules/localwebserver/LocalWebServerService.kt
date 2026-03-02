package com.adapterrn84.turbomodules.localwebserver

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

class LocalWebServerService : Service() {

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
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var heartbeatFuture: ScheduledFuture<*>? = null
    private var cleanupFuture: ScheduledFuture<*>? = null

    private var server: LocalWebServer? = null
    private var deviceManager: DeviceConnectionManager? = null
    var config: ServerConfig = ServerConfig()

    @Volatile var status = "STOPPED"
    var addresses: List<Pair<String, String>> = emptyList()
    var lastError: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("等待启动..."))
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 被系统杀死重启后，尝试自动恢复
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean("autoStart", false)) {
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

    // ─── 公开接口（供 TurboModule 调用）──────────────────────────────────────

    @Synchronized
    fun startServer(cfg: ServerConfig): String? {
        if (status == "RUNNING") return null
        status = "STARTING"; lastError = null
        return try {
            config = cfg
            val dm = DeviceConnectionManager(cfg)
            val srv = LocalWebServer(cfg, dm)
            srv.start()
            deviceManager = dm
            server = srv
            addresses = srv.getAddresses()
            status = "RUNNING"
            scheduleTimers(cfg)
            savePrefs(cfg)
            updateNotification("运行中 :${cfg.port}")
            null
        } catch (e: Exception) {
            status = "ERROR"; lastError = e.message
            Log.e(TAG, "start failed", e)
            e.message
        }
    }

    @Synchronized
    fun stopServer() {
        heartbeatFuture?.cancel(false); heartbeatFuture = null
        cleanupFuture?.cancel(false); cleanupFuture = null
        server?.stop(); server = null; deviceManager = null
        addresses = emptyList(); status = "STOPPED"; lastError = null
        clearPrefs()
        updateNotification("已停止")
    }

    fun getStats(): ServerStats = deviceManager?.getStats()
        ?: ServerStats(0, 0, 0, 0)

    // ─── 定时器 ───────────────────────────────────────────────────────────────

    private fun scheduleTimers(cfg: ServerConfig) {
        heartbeatFuture = scheduler.scheduleAtFixedRate({
            server?.sendHeartbeat()
            server?.checkHeartbeatTimeouts()
            server?.checkRetryQueueTimeouts()
        }, cfg.heartbeatInterval, cfg.heartbeatInterval, TimeUnit.MILLISECONDS)

        cleanupFuture = scheduler.scheduleAtFixedRate({
            deviceManager?.cleanExpiredPending()
        }, 60, 60, TimeUnit.SECONDS)
    }

    // ─── 通知 ─────────────────────────────────────────────────────────────────

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
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    // ─── SharedPrefs（自动恢复用）─────────────────────────────────────────────

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
