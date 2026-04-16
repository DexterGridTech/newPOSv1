package com.impos2.adapterv2.topologyhost

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * topology host 的 Android 生命周期壳。
 *
 * 职责与旧 `LocalWebServerService` 保持一致：
 * - 承载真正的 server 实例
 * - 以前台服务方式保持稳定
 * - 统一状态和诊断
 */
class TopologyHostService : Service() {
  enum class ServiceState {
    STOPPED,
    STARTING,
    RUNNING,
    STOPPING,
    ERROR,
  }

  companion object {
    private const val TAG = "TopologyHostService"
    private const val CHANNEL_ID = "topology_host_channel"
    private const val NOTIFICATION_ID = 2101
    private const val PREFS_NAME = "topology_host_service"

    fun start(context: Context) {
      val intent = Intent(context, TopologyHostService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, TopologyHostService::class.java))
    }
  }

  inner class TopologyHostBinder : Binder() {
    fun get(): TopologyHostService = this@TopologyHostService
  }

  private val binder = TopologyHostBinder()
  private val startCount = AtomicInteger(0)
  private val stopCount = AtomicInteger(0)
  private val bindCount = AtomicInteger(0)
  private val autoRecoverCount = AtomicInteger(0)
  private val notificationUpdateCount = AtomicInteger(0)
  private val lastStatusChangeAt = AtomicLong(System.currentTimeMillis())

  @Volatile
  var state: ServiceState = ServiceState.STOPPED
    private set

  @Volatile
  var config: TopologyHostConfig = TopologyHostConfig()
    private set

  @Volatile
  var lastError: String? = null
    private set

  @Volatile
  var lastStartedAt: Long = 0L
    private set

  @Volatile
  var lastStoppedAt: Long = 0L
    private set

  @Volatile
  private var server: TopologyHostServer? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    startForeground(NOTIFICATION_ID, buildNotification("等待启动"))
  }

  override fun onBind(intent: Intent): IBinder {
    bindCount.incrementAndGet()
    return binder
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (prefs.getBoolean("autoStart", false)) {
      autoRecoverCount.incrementAndGet()
      startServer(
        TopologyHostConfig(
          port = prefs.getInt("port", TopologyHostDefaults.DEFAULT_PORT),
          basePath = prefs.getString("basePath", TopologyHostDefaults.DEFAULT_BASE_PATH)
            ?: TopologyHostDefaults.DEFAULT_BASE_PATH,
          heartbeatIntervalMs = prefs.getLong("heartbeatIntervalMs", TopologyHostDefaults.DEFAULT_HEARTBEAT_INTERVAL_MS),
          heartbeatTimeoutMs = prefs.getLong("heartbeatTimeoutMs", TopologyHostDefaults.DEFAULT_HEARTBEAT_TIMEOUT_MS),
          defaultTicketExpiresInMs = prefs.getLong("defaultTicketExpiresInMs", TopologyHostDefaults.DEFAULT_TICKET_EXPIRES_IN_MS),
        ),
      )
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopServer(clearPrefs = false)
    super.onDestroy()
  }

  @Synchronized
  fun startServer(nextConfig: TopologyHostConfig): String? {
    when (state) {
      ServiceState.RUNNING -> return null
      ServiceState.STARTING -> return null
      ServiceState.STOPPING -> {
        val message = "topology host is stopping"
        recordError(message, null)
        return message
      }
      ServiceState.STOPPED,
      ServiceState.ERROR -> Unit
    }

    updateState(ServiceState.STARTING)
    lastError = null
    return try {
      stopRuntime(clearPrefs = false)
      config = nextConfig
      val hostServer = TopologyHostServer(applicationContext, nextConfig, com.impos2.adapterv2.logger.LogManager.getInstance(applicationContext))
      hostServer.start()
      server = hostServer
      lastStartedAt = System.currentTimeMillis()
      startCount.incrementAndGet()
      savePrefs(nextConfig)
      updateState(ServiceState.RUNNING)
      updateNotification("运行中 ${hostServer.getAddressInfo().wsUrl}")
      null
    } catch (error: Exception) {
      stopRuntime(clearPrefs = false)
      updateState(ServiceState.ERROR)
      recordError(error.message ?: "topology host start failed", error)
      error.message ?: "topology host start failed"
    }
  }

  @Synchronized
  fun stopServer(clearPrefs: Boolean = true) {
    when (state) {
      ServiceState.STOPPED -> {
        stopRuntime(clearPrefs)
        updateNotification("已停止")
        return
      }
      ServiceState.STOPPING -> return
      ServiceState.STARTING,
      ServiceState.RUNNING,
      ServiceState.ERROR -> Unit
    }

    updateState(ServiceState.STOPPING)
    try {
      stopRuntime(clearPrefs)
      lastError = null
      lastStoppedAt = System.currentTimeMillis()
      stopCount.incrementAndGet()
      updateState(ServiceState.STOPPED)
      updateNotification("已停止")
    } catch (error: Exception) {
      updateState(ServiceState.ERROR)
      recordError(error.message ?: "topology host stop failed", error)
      updateNotification("停止异常")
    }
  }

  fun getAddressInfo(): TopologyHostAddressInfo? = server?.getAddressInfo()

  fun getStatusInfo(): TopologyHostStatusInfo {
    return TopologyHostStatusInfo(
      state = when (state) {
        ServiceState.STOPPED -> TopologyHostServiceState.STOPPED
        ServiceState.STARTING -> TopologyHostServiceState.STARTING
        ServiceState.RUNNING -> TopologyHostServiceState.RUNNING
        ServiceState.STOPPING -> TopologyHostServiceState.STOPPING
        ServiceState.ERROR -> TopologyHostServiceState.ERROR
      },
      addressInfo = server?.getAddressInfo(),
      config = config,
      error = lastError,
    )
  }

  fun getStats(): TopologyHostStats = server?.getStats() ?: TopologyHostStats()

  fun getDiagnosticsSnapshot(): TopologyHostDiagnosticsSnapshot? = server?.getDiagnosticsSnapshot()

  fun issueTicket(
    masterNodeId: String,
    transportUrls: List<String>,
    expiresInMs: Long,
  ): TopologyHostTicketResponse {
    val current = server ?: throw IllegalStateException("TopologyHostService not running")
    return current.issueTicket(masterNodeId, transportUrls, expiresInMs)
  }

  fun replaceFaultRules(rules: List<TopologyHostFaultRule>): TopologyHostFaultRuleReplaceResponse {
    val current = server ?: return TopologyHostFaultRuleReplaceResponse(success = false, ruleCount = 0)
    return current.replaceFaultRules(rules)
  }

  fun dumpState(): String {
    return buildString {
      append("state=")
      append(state)
      append(", config=")
      append(config)
      append(", lastError=")
      append(lastError ?: "null")
      append(", lastStartedAt=")
      append(lastStartedAt)
      append(", lastStoppedAt=")
      append(lastStoppedAt)
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
      append(", statusChangedAt=")
      append(lastStatusChangeAt.get())
      append(", server=")
      append(server?.dumpState() ?: "null")
    }
  }

  private fun stopRuntime(clearPrefs: Boolean) {
    try {
      server?.stop()
    } catch (error: Exception) {
      Log.w(TAG, "stopRuntime failed", error)
      recordError(error.message ?: "stop runtime failed", error)
    } finally {
      server = null
    }
    if (clearPrefs) {
      clearPrefs()
    }
  }

  private fun savePrefs(config: TopologyHostConfig) {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("autoStart", true)
      .putInt("port", config.port)
      .putString("basePath", config.basePath)
      .putLong("heartbeatIntervalMs", config.heartbeatIntervalMs)
      .putLong("heartbeatTimeoutMs", config.heartbeatTimeoutMs)
      .putLong("defaultTicketExpiresInMs", config.defaultTicketExpiresInMs)
      .apply()
  }

  private fun clearPrefs() {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
  }

  private fun updateState(next: ServiceState) {
    state = next
    lastStatusChangeAt.set(System.currentTimeMillis())
  }

  private fun recordError(message: String, error: Throwable?) {
    lastError = message
    if (error == null) {
      Log.e(TAG, message)
    } else {
      Log.e(TAG, message, error)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Topology Host",
        NotificationManager.IMPORTANCE_LOW,
      )
      channel.setShowBadge(false)
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(text: String): Notification {
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("TopologyHost")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_menu_share)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(text: String) {
    notificationUpdateCount.incrementAndGet()
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(text))
  }
}
