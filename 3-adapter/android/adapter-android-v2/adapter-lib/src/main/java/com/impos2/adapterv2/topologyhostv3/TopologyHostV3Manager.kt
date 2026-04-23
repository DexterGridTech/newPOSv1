package com.impos2.adapterv2.topologyhostv3

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Looper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class TopologyHostV3Manager private constructor(private val context: Context) {
  companion object {
    @Volatile
    private var instance: TopologyHostV3Manager? = null

    fun getInstance(context: Context): TopologyHostV3Manager {
      return instance ?: synchronized(this) {
        instance ?: TopologyHostV3Manager(context.applicationContext).also { instance = it }
      }
    }
  }

  @Volatile
  private var service: TopologyHostV3Service? = null
  @Volatile
  private var bound = false
  @Volatile
  private var bindLatch: CountDownLatch? = null

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
      service = (binder as? TopologyHostV3Service.BinderImpl)?.get()
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
  fun start(config: TopologyHostV3Config = TopologyHostV3Config()): TopologyHostV3AddressInfo {
    ensureBound()
    val target = service ?: throw IllegalStateException("TopologyHostV3Service not ready")
    val error = target.startServer(config)
    if (error != null) {
      throw IllegalStateException(error)
    }
    return target.getAddressInfo()
      ?: throw IllegalStateException("topology host v3 address info unavailable")
  }

  @Synchronized
  fun stop() {
    service?.stopServer()
  }

  fun getStatus(): TopologyHostV3StatusInfo {
    return service?.getStatusInfo()
      ?: TopologyHostV3StatusInfo(
        state = TopologyHostV3ServiceState.STOPPED,
        addressInfo = null,
        config = TopologyHostV3Config(),
      )
  }

  fun getStats(): TopologyHostV3Stats = service?.getStats() ?: TopologyHostV3Stats()

  fun getDiagnosticsSnapshot(): TopologyHostV3DiagnosticsSnapshot? = service?.getDiagnosticsSnapshot()

  fun replaceFaultRules(rules: List<TopologyHostV3FaultRule>): Int {
    ensureBound()
    return service?.replaceFaultRules(rules) ?: 0
  }

  private fun ensureBound() {
    if (bound && service != null) return
    if (Looper.myLooper() == Looper.getMainLooper()) {
      throw IllegalStateException("TopologyHostV3Service synchronous bind must not run on main thread")
    }
    val latch = CountDownLatch(1)
    bindLatch = latch
    TopologyHostV3Service.start(context)
    val intent = Intent(context, TopologyHostV3Service::class.java)
    val bindResult = context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    if (!bindResult) {
      bindLatch = null
      throw IllegalStateException("TopologyHostV3Service bind failed")
    }
    val completed = latch.await(3, TimeUnit.SECONDS)
    bindLatch = null
    if (!completed || !bound || service == null) {
      throw IllegalStateException("TopologyHostV3Service bind timeout")
    }
  }
}
