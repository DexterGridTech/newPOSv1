package com.impos2.posadapter.turbomodules

import com.facebook.react.bridge.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class ScriptsTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ScriptsTurboModule"
        private const val MAX_LOGS = 100
    }

    private val total   = AtomicInteger(0)
    private val success = AtomicInteger(0)
    private val failed  = AtomicInteger(0)
    private val totalMs = java.util.concurrent.atomic.AtomicLong(0)
    private val logs    = ConcurrentHashMap<Long, WritableMap>()

    override fun getName() = NAME

    @ReactMethod
    @Synchronized
    fun logExecution(script: String, executionTime: Int, isSuccess: Boolean, error: String?, promise: Promise) {
        try {
            total.incrementAndGet()
            if (isSuccess) success.incrementAndGet() else failed.incrementAndGet()
            totalMs.addAndGet(executionTime.toLong())
            val entry = Arguments.createMap().apply {
                putDouble("timestamp", System.currentTimeMillis().toDouble())
                putString("script", if (script.length > 100) script.take(100) + "…" else script)
                putInt("executionTime", executionTime)
                putBoolean("success", isSuccess)
                if (!error.isNullOrEmpty()) putString("error", error) else putNull("error")
            }
            val key = System.currentTimeMillis()
            logs[key] = entry
            if (logs.size > MAX_LOGS) logs.remove(logs.keys.minOrNull())
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("LOG_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        val t = total.get()
        promise.resolve(Arguments.createMap().apply {
            putInt("total", t)
            putInt("success", success.get())
            putInt("failed", failed.get())
            putDouble("successRate", if (t > 0) success.get() * 100.0 / t else 0.0)
            putDouble("avgTime", if (t > 0) totalMs.toDouble() / t else 0.0)
        })
    }

    @ReactMethod
    fun clearStats(promise: Promise) {
        total.set(0); success.set(0); failed.set(0); totalMs.set(0L); logs.clear()
        promise.resolve(null)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
