package com.adapterrn84.turbomodules

import com.adapterrn84.turbomodules.scripts.*
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

@ReactModule(name = ScriptsTurboModule.NAME)
class ScriptsTurboModule(reactContext: ReactApplicationContext) :
    NativeScriptsTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "ScriptsTurboModule"
        const val EVENT_NATIVE_CALL = "onNativeCall"
    }

    private val activeContexts = ConcurrentHashMap<String, ScriptExecutionContext>()
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val total   = AtomicInteger(0)
    private val success = AtomicInteger(0)
    private val failed  = AtomicInteger(0)
    private val totalMs = AtomicLong(0)

    override fun getName() = NAME

    override fun executeScript(
        script: String,
        paramsJson: String,
        globalsJson: String,
        nativeFuncNames: ReadableArray,
        timeout: Double,
        promise: Promise,
    ) {
        if (script.isBlank()) {
            promise.reject(ScriptErrorCode.EMPTY_SCRIPT, "Script cannot be empty")
            return
        }
        if (script.length > 256 * 1024) {
            promise.reject(ScriptErrorCode.UNKNOWN, "Script too large (max 256KB)")
            return
        }

        val funcNames = Array(nativeFuncNames.size()) { i ->
            nativeFuncNames.getString(i) ?: ""
        }
        val executionId = UUID.randomUUID().toString().replace("-", "")
        val startTime = System.currentTimeMillis()

        moduleScope.launch {
            val ctx = ScriptExecutionContext(executionId, reactApplicationContext, EVENT_NATIVE_CALL)
            activeContexts[executionId] = ctx
            try {
                val result = ctx.execute(script, paramsJson, globalsJson, funcNames, timeout.toInt())
                val elapsed = (System.currentTimeMillis() - startTime).toInt()
                recordStats(elapsed, true)
                promise.resolve(result)
            } catch (e: ScriptExecutionException) {
                val elapsed = (System.currentTimeMillis() - startTime).toInt()
                recordStats(elapsed, false)
                promise.reject(e.code, e.message, e)
            } catch (e: Exception) {
                val elapsed = (System.currentTimeMillis() - startTime).toInt()
                recordStats(elapsed, false)
                promise.reject(ScriptErrorCode.UNKNOWN, e.message ?: "Unknown error", e)
            } finally {
                activeContexts.remove(executionId)
                ctx.destroy()
            }
        }
    }

    override fun resolveNativeCall(callId: String, resultJson: String, promise: Promise) {
        val executionId = callId.substringBefore(':')
        activeContexts[executionId]?.resolveNativeCall(callId, resultJson)
        promise.resolve(null)
    }

    override fun rejectNativeCall(callId: String, errorMessage: String, promise: Promise) {
        val executionId = callId.substringBefore(':')
        activeContexts[executionId]?.rejectNativeCall(callId, errorMessage)
        promise.resolve(null)
    }

    override fun getStats(promise: Promise) {
        val t = total.get()
        promise.resolve(Arguments.createMap().apply {
            putInt("total", t)
            putInt("success", success.get())
            putInt("failed", failed.get())
            putDouble("successRate", if (t > 0) success.get() * 100.0 / t else 0.0)
            putDouble("avgTime", if (t > 0) totalMs.get().toDouble() / t else 0.0)
        })
    }

    override fun clearStats(promise: Promise) {
        total.set(0); success.set(0); failed.set(0); totalMs.set(0L)
        promise.resolve(null)
    }

    override fun addListener(eventName: String) {}
    override fun removeListeners(count: Double) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        activeContexts.values.forEach { it.cancel() }
        activeContexts.clear()
        moduleScope.cancel()
    }

    private fun recordStats(elapsedMs: Int, isSuccess: Boolean) {
        total.incrementAndGet()
        if (isSuccess) success.incrementAndGet() else failed.incrementAndGet()
        totalMs.addAndGet(elapsedMs.toLong())
    }
}
