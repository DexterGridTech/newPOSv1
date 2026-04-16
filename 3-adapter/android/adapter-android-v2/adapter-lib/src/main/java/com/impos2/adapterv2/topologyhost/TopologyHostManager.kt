package com.impos2.adapterv2.topologyhost

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * topology host 的应用层门面。
 *
 * 对上层隐藏 Service 绑定细节，统一暴露：
 * - start / stop
 * - status / stats / diagnostics
 * - fault rule 更新
 */
class TopologyHostManager private constructor(private val context: Context) {
  companion object {
    @Volatile
    private var instance: TopologyHostManager? = null

    fun getInstance(context: Context): TopologyHostManager {
      return instance ?: synchronized(this) {
        instance ?: TopologyHostManager(context.applicationContext).also { instance = it }
      }
    }
  }

  @Volatile
  private var service: TopologyHostService? = null
  @Volatile
  private var bound = false
  @Volatile
  private var bindLatch: CountDownLatch? = null

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
      service = (binder as? TopologyHostService.TopologyHostBinder)?.get()
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
  fun start(config: TopologyHostConfig = TopologyHostConfig()): TopologyHostAddressInfo {
    ensureBound()
    val target = service ?: throw IllegalStateException("TopologyHostService not ready")
    val error = target.startServer(config)
    if (error != null) {
      throw IllegalStateException(error)
    }
    return target.getAddressInfo()
      ?: throw IllegalStateException("topology host address info unavailable")
  }

  @Synchronized
  fun stop() {
    service?.stopServer()
  }

  fun getStatus(): TopologyHostStatusInfo {
    return service?.getStatusInfo()
      ?: TopologyHostStatusInfo(
        state = TopologyHostServiceState.STOPPED,
        addressInfo = null,
        config = TopologyHostConfig(),
      )
  }

  fun getStats(): TopologyHostStats = service?.getStats() ?: TopologyHostStats()

  fun getDiagnosticsSnapshot(): TopologyHostDiagnosticsSnapshot? = service?.getDiagnosticsSnapshot()

  fun issueTicket(
    masterNodeId: String,
    transportUrls: List<String>,
    expiresInMs: Long,
  ): TopologyHostTicketResponse {
    ensureBound()
    val target = service ?: throw IllegalStateException("TopologyHostService not ready")
    return target.issueTicket(masterNodeId, transportUrls, expiresInMs)
  }

  fun replaceFaultRules(rules: List<TopologyHostFaultRule>): TopologyHostFaultRuleReplaceResponse {
    ensureBound()
    val target = service ?: throw IllegalStateException("TopologyHostService not ready")
    return target.replaceFaultRules(rules)
  }

  fun dumpState(): String {
    return service?.dumpState() ?: "TopologyHostService not bound"
  }

  private fun ensureBound() {
    if (bound && service != null) return
    val latch = CountDownLatch(1)
    bindLatch = latch
    TopologyHostService.start(context)
    val intent = Intent(context, TopologyHostService::class.java)
    val bindResult = context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    if (!bindResult) {
      bindLatch = null
      throw IllegalStateException("TopologyHostService bind failed")
    }
    val completed = latch.await(3, TimeUnit.SECONDS)
    bindLatch = null
    if (!completed || !bound || service == null) {
      throw IllegalStateException("TopologyHostService bind timeout")
    }
  }
}
