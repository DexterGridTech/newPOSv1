package com.adapterrn84.turbomodules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.adapterrn84.NativeLocalWebServerTurboModuleSpec
import com.adapterrn84.turbomodules.localwebserver.LocalWebServerService
import com.adapterrn84.turbomodules.localwebserver.RuntimeConfig
import com.adapterrn84.turbomodules.localwebserver.ServerConfig
import com.facebook.react.bridge.*
import java.util.concurrent.Executors

class LocalWebServerTurboModule(reactContext: ReactApplicationContext) :
    NativeLocalWebServerTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "LocalWebServerTurboModule"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private var service: LocalWebServerService? = null
    private var bound = false

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(n: ComponentName?, b: IBinder?) {
            service = (b as LocalWebServerService.LwsBinder).get()
            bound = true
        }
        override fun onServiceDisconnected(n: ComponentName?) { service = null; bound = false }
    }

    override fun getName() = NAME

    // ─── start ───────────────────────────────────────────────────────────────

    override fun startLocalWebServer(config: ReadableMap, promise: Promise) {
        executor.submit {
            ensureBound()
            val svc = service
            if (svc == null) { promise.reject("NOT_BOUND", "Service not ready"); return@submit }
            val serverConfig = ServerConfig(
                port = if (config.hasKey("port")) config.getInt("port") else 8888,
                basePath = config.getString("basePath") ?: "/localServer",
                heartbeatInterval = if (config.hasKey("heartbeatInterval")) config.getInt("heartbeatInterval").toLong() else 30_000L,
                defaultRuntimeConfig = RuntimeConfig(
                    heartbeatTimeout = if (config.hasKey("heartbeatTimeout")) config.getInt("heartbeatTimeout").toLong() else 60_000L,
                    retryCacheTimeout = if (config.hasKey("retryCacheTimeout")) config.getInt("retryCacheTimeout").toLong() else 30_000L,
                ),
            )
            val err = svc.startServer(serverConfig)
            if (err != null) { promise.reject("START_ERROR", err); return@submit }
            promise.resolve(buildStatusMap(svc))
        }
    }

    // ─── stop ────────────────────────────────────────────────────────────────

    override fun stopLocalWebServer(promise: Promise) {
        executor.submit {
            service?.stopServer()
            promise.resolve(null)
        }
    }

    // ─── status ──────────────────────────────────────────────────────────────

    override fun getLocalWebServerStatus(promise: Promise) {
        executor.submit {
            val svc = service
            if (svc == null) {
                // 未绑定时返回 STOPPED 状态，不报错
                promise.resolve(Arguments.createMap().apply {
                    putString("status", "STOPPED")
                    putArray("addresses", Arguments.createArray())
                    putNull("error")
                })
                return@submit
            }
            promise.resolve(buildStatusMap(svc))
        }
    }

    // ─── stats ───────────────────────────────────────────────────────────────

    override fun getLocalWebServerStats(promise: Promise) {
        executor.submit {
            val stats = service?.getStats()
            promise.resolve(Arguments.createMap().apply {
                putInt("masterCount", stats?.masterCount ?: 0)
                putInt("slaveCount", stats?.slaveCount ?: 0)
                putInt("pendingCount", stats?.pendingCount ?: 0)
                putDouble("uptime", (stats?.uptime ?: 0L).toDouble())
            })
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private fun buildStatusMap(svc: LocalWebServerService): WritableMap =
        Arguments.createMap().apply {
            putString("status", svc.status)
            putArray("addresses", Arguments.createArray().also { arr ->
                svc.addresses.forEach { (name, addr) ->
                    arr.pushMap(Arguments.createMap().apply { putString("name", name); putString("address", addr) })
                }
            })
            putMap("config", Arguments.createMap().apply {
                putInt("port", svc.config.port)
                putString("basePath", svc.config.basePath)
                putDouble("heartbeatInterval", svc.config.heartbeatInterval.toDouble())
                putDouble("heartbeatTimeout", svc.config.defaultRuntimeConfig.heartbeatTimeout.toDouble())
            })
            if (svc.lastError != null) putString("error", svc.lastError) else putNull("error")
        }

    private fun ensureBound() {
        if (bound) return
        LocalWebServerService.start(reactApplicationContext)
        val intent = Intent(reactApplicationContext, LocalWebServerService::class.java)
        reactApplicationContext.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        val deadline = System.currentTimeMillis() + 3000
        while (!bound && System.currentTimeMillis() < deadline) Thread.sleep(50)
    }

    override fun invalidate() {
        super.invalidate()
        if (bound) { reactApplicationContext.unbindService(conn); bound = false }
        executor.shutdown()
        executor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)
    }
}
