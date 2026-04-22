package com.adapterrn84.turbomodules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.adapterrn84.turbomodules.localwebserver.*
import org.json.JSONObject
import java.util.concurrent.Executors

@ReactModule(name = LocalWebServerTurboModule.NAME)
class LocalWebServerTurboModule(reactContext: ReactApplicationContext) :
    NativeLocalWebServerTurboModuleSpec(reactContext) {

    companion object { const val NAME = "LocalWebServerTurboModule" }

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

    @ReactMethod
    override fun startLocalWebServer(configJson: String, promise: Promise) {
        executor.submit {
            ensureBound()
            val svc = service
            if (svc == null) { promise.reject("NOT_BOUND", "Service not ready"); return@submit }
            val cfg = parseConfig(configJson)
            val err = svc.startServer(cfg)
            if (err != null) { promise.reject("START_ERROR", err); return@submit }
            promise.resolve(buildStatusMap(svc))
        }
    }

    @ReactMethod
    override fun stopLocalWebServer(promise: Promise) {
        executor.submit {
            service?.stopServer()
            promise.resolve(null)
        }
    }

    @ReactMethod
    override fun getLocalWebServerStatus(promise: Promise) {
        executor.submit {
            val svc = service
            if (svc == null) {
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

    @ReactMethod
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

    private fun parseConfig(json: String): ServerConfig {
        val j = JSONObject(json)
        return ServerConfig(
            port = j.optInt("port", 8888),
            basePath = j.optString("basePath", "/localServer"),
            heartbeatInterval = j.optLong("heartbeatInterval", 30_000L),
            defaultRuntimeConfig = RuntimeConfig(
                heartbeatTimeout = j.optLong("heartbeatTimeout", 60_000L),
                retryCacheTimeout = j.optLong("retryCacheTimeout", 30_000L),
            ),
        )
    }

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

    @ReactMethod
    override fun addListener(eventName: String) {}

    @ReactMethod
    override fun removeListeners(count: Double) {}
}
