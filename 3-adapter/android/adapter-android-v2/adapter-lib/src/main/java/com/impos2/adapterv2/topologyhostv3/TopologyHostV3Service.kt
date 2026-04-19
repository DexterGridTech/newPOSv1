package com.impos2.adapterv2.topologyhostv3

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.impos2.adapterv2.logger.LogManager

class TopologyHostV3Service : Service() {
  companion object {
    private const val CHANNEL_ID = "topology_host_v3_channel"
    private const val NOTIFICATION_ID = 2102

    fun start(context: Context) {
      val intent = Intent(context, TopologyHostV3Service::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, TopologyHostV3Service::class.java))
    }
  }

  inner class BinderImpl : Binder() {
    fun get(): TopologyHostV3Service = this@TopologyHostV3Service
  }

  private val binder = BinderImpl()
  @Volatile
  private var server: TopologyHostV3Server? = null
  @Volatile
  private var config: TopologyHostV3Config = TopologyHostV3Config()
  @Volatile
  private var state: TopologyHostV3ServiceState = TopologyHostV3ServiceState.STOPPED
  @Volatile
  private var lastError: String? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    startForeground(NOTIFICATION_ID, buildNotification("等待启动"))
  }

  override fun onBind(intent: Intent): IBinder = binder

  override fun onDestroy() {
    stopServer()
    super.onDestroy()
  }

  @Synchronized
  fun startServer(nextConfig: TopologyHostV3Config): String? {
    if (state == TopologyHostV3ServiceState.RUNNING || state == TopologyHostV3ServiceState.STARTING) {
      return null
    }
    state = TopologyHostV3ServiceState.STARTING
    return try {
      stopServer()
      config = nextConfig
      val nextServer = TopologyHostV3Server(
        applicationContext,
        nextConfig,
        LogManager.getInstance(applicationContext),
      )
      nextServer.start()
      server = nextServer
      state = TopologyHostV3ServiceState.RUNNING
      updateNotification("运行中 ${nextServer.getAddressInfo().wsUrl}")
      null
    } catch (error: Exception) {
      lastError = error.message
      state = TopologyHostV3ServiceState.ERROR
      error.message ?: "topology host v3 start failed"
    }
  }

  @Synchronized
  fun stopServer() {
    if (state == TopologyHostV3ServiceState.STOPPED || state == TopologyHostV3ServiceState.STOPPING) {
      server = null
      state = TopologyHostV3ServiceState.STOPPED
      return
    }
    state = TopologyHostV3ServiceState.STOPPING
    runCatching { server?.stop() }
    server = null
    state = TopologyHostV3ServiceState.STOPPED
    updateNotification("已停止")
  }

  fun getAddressInfo(): TopologyHostV3AddressInfo? = server?.getAddressInfo()

  fun getStatusInfo(): TopologyHostV3StatusInfo {
    return TopologyHostV3StatusInfo(
      state = state,
      addressInfo = server?.getAddressInfo(),
      config = config,
      error = lastError,
    )
  }

  fun getStats(): TopologyHostV3Stats = server?.getStats() ?: TopologyHostV3Stats()

  fun getDiagnosticsSnapshot(): TopologyHostV3DiagnosticsSnapshot? = server?.getDiagnosticsSnapshot()

  fun replaceFaultRules(rules: List<TopologyHostV3FaultRule>): Int {
    return server?.replaceFaultRules(rules) ?: 0
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Topology Host V3", NotificationManager.IMPORTANCE_LOW),
    )
  }

  private fun buildNotification(text: String): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("TopologyHostV3")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(text: String) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(text))
  }
}
