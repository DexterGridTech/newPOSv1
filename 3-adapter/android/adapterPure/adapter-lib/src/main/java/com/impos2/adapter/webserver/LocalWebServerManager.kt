package com.impos2.adapter.webserver

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import com.impos2.adapter.interfaces.ILocalWebServer
import com.impos2.adapter.interfaces.LocalWebServerConfig
import com.impos2.adapter.interfaces.LocalWebServerInfo
import com.impos2.adapter.interfaces.LocalWebServerStatus
import com.impos2.adapter.interfaces.ServerAddress

/**
 * LocalWebServer 的应用层门面。
 *
 * 这个类不直接实现 WebServer，而是负责：
 * - 启动并绑定 [LocalWebServerService]；
 * - 把 Service 生命周期收敛成同步 manager 接口；
 * - 对上层暴露稳定的 start/stop/status/stats 访问方式。
 *
 * 设计目的：
 * - 让上层无需理解 Service 绑定、Binder 获取、等待连接等 Android 细节；
 * - 把 WebServer 能力表现成普通 manager，便于在整合层和测试页复用。
 */
class LocalWebServerManager private constructor(private val context: Context) : ILocalWebServer {

  companion object {
    @Volatile
    private var instance: LocalWebServerManager? = null

    fun getInstance(context: Context): LocalWebServerManager {
      return instance ?: synchronized(this) {
        instance ?: LocalWebServerManager(context.applicationContext).also { instance = it }
      }
    }
  }

  // 当前已绑定到的 Service 实例。只有绑定成功后才允许真正执行业务调用。
  @Volatile
  private var service: LocalWebServerService? = null

  @Volatile
  private var bound = false

  @Volatile
  private var bindLatch: CountDownLatch? = null

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
      service = (binder as? LocalWebServerService.LwsBinder)?.get()
      bound = service != null
      bindLatch?.countDown()
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      bound = false
      service = null
      bindLatch = null
    }
  }

  @Synchronized
  override fun start(config: LocalWebServerConfig): List<ServerAddress> {
    ensureBound()
    val target = service ?: throw IllegalStateException("LocalWebServerService not ready")
    val serverConfig = ServerConfig(
      port = config.port,
      basePath = config.basePath,
      heartbeatInterval = config.heartbeatInterval,
      defaultRuntimeConfig = RuntimeConfig(
        heartbeatTimeout = config.heartbeatTimeout,
        retryCacheTimeout = 30_000L,
      ),
    )
    val error = target.startServer(serverConfig)
    if (error != null) {
      throw IllegalStateException(error)
    }
    return target.addresses.map { (name, address) ->
      ServerAddress(name = name, address = address)
    }
  }

  @Synchronized
  override fun stop() {
    val target = service ?: return
    target.stopServer()
  }

  override fun getStatus(): LocalWebServerInfo {
    val target = service
    if (target == null) {
      return LocalWebServerInfo(
        status = LocalWebServerStatus.STOPPED,
        addresses = emptyList(),
        config = LocalWebServerConfig(),
        error = null,
      )
    }

    return LocalWebServerInfo(
      status = target.state.toPublicStatus(),
      addresses = target.addresses.map { (name, address) ->
        ServerAddress(name = name, address = address)
      },
      config = LocalWebServerConfig(
        port = target.config.port,
        basePath = target.config.basePath,
        heartbeatInterval = target.config.heartbeatInterval,
        heartbeatTimeout = target.config.defaultRuntimeConfig.heartbeatTimeout,
      ),
      error = target.lastError,
    )
  }

  override fun getStats(): com.impos2.adapter.interfaces.ServerStats {
    val stats = service?.getStats()
    return com.impos2.adapter.interfaces.ServerStats(
      masterCount = stats?.masterCount ?: 0,
      slaveCount = stats?.slaveCount ?: 0,
      pendingCount = stats?.pendingCount ?: 0,
      uptime = stats?.uptime ?: 0L,
      requestCount = stats?.requestCount ?: 0L,
    )
  }

  private fun ensureBound() {
    if (bound && service != null) return
    val latch = CountDownLatch(1)
    bindLatch = latch
    LocalWebServerService.start(context)
    val intent = Intent(context, LocalWebServerService::class.java)
    val bindResult = context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    if (!bindResult) {
      bindLatch = null
      throw IllegalStateException("LocalWebServerService bind failed")
    }
    val completed = latch.await(3, TimeUnit.SECONDS)
    bindLatch = null
    if (!completed || !bound || service == null) {
      throw IllegalStateException("LocalWebServerService bind timeout")
    }
  }

  private fun LocalWebServerService.ServiceState.toPublicStatus(): LocalWebServerStatus {
    return when (this) {
      LocalWebServerService.ServiceState.STARTING -> LocalWebServerStatus.STARTING
      LocalWebServerService.ServiceState.RUNNING -> LocalWebServerStatus.RUNNING
      LocalWebServerService.ServiceState.STOPPING -> LocalWebServerStatus.STOPPING
      LocalWebServerService.ServiceState.ERROR -> LocalWebServerStatus.ERROR
      LocalWebServerService.ServiceState.STOPPED -> LocalWebServerStatus.STOPPED
    }
  }
}
