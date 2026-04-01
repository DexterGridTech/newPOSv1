package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.adapter.interfaces.ScriptExecutionOptions
import com.impos2.adapter.interfaces.ScriptExecutionResult
import com.impos2.adapter.interfaces.ScriptStats
import com.impos2.adapter.scripts.ScriptEngineManager
import com.impos2.mixcretailrn84v2.turbomodules.NativeScriptsTurboModuleSpec
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@ReactModule(name = ScriptsTurboModule.NAME)
class ScriptsTurboModule(reactContext: ReactApplicationContext) :
  NativeScriptsTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "ScriptsTurboModule"
    private const val EVENT_NATIVE_CALL = "onNativeCall"
  }

  private data class PendingNativeCall(
    val funcName: String,
    val argsJson: String,
    val timeoutMs: Long,
    val latch: CountDownLatch = CountDownLatch(1),
    @Volatile var resultJson: String? = null,
    @Volatile var errorMessage: String? = null,
  )

  private val scriptEngine by lazy { ScriptEngineManager.getInstance(reactApplicationContext) }
  private val pendingNativeCalls = ConcurrentHashMap<String, PendingNativeCall>()

  override fun getName(): String = NAME

  override fun executeScript(
    script: String,
    paramsJson: String,
    globalsJson: String,
    nativeFuncNames: ReadableArray,
    timeout: Double,
    promise: Promise
  ) {
    runCatching {
      val names = Array(nativeFuncNames.size()) { index -> nativeFuncNames.getString(index).orEmpty() }
      val result = scriptEngine.executeScript(
        ScriptExecutionOptions(
          script = script,
          paramsJson = paramsJson,
          globalsJson = globalsJson,
          nativeFuncNames = names,
          timeout = timeout.toInt(),
          nativeFunctionInvoker = { funcName, argsJson, timeoutMs ->
            invokeNativeFunction(funcName, argsJson, timeoutMs)
          },
        )
      )
      toWritableMap(result)
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("EXECUTE_SCRIPT_ERROR", it.message, it)
    }
  }

  override fun resolveNativeCall(callId: String, resultJson: String, promise: Promise) {
    pendingNativeCalls.remove(callId)?.apply {
      this.resultJson = resultJson
      latch.countDown()
    }
    promise.resolve(null)
  }

  override fun rejectNativeCall(callId: String, errorMessage: String, promise: Promise) {
    pendingNativeCalls.remove(callId)?.apply {
      this.errorMessage = errorMessage
      latch.countDown()
    }
    promise.resolve(null)
  }

  override fun getStats(promise: Promise) {
    runCatching {
      toWritableMap(scriptEngine.getStats())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_SCRIPT_STATS_ERROR", it.message, it)
    }
  }

  override fun clearStats() {
    scriptEngine.clearStats()
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  private fun invokeNativeFunction(funcName: String, argsJson: String, timeoutMs: Long): String {
    val callId = "${System.currentTimeMillis()}:${System.nanoTime()}"
    val pendingCall = PendingNativeCall(
      funcName = funcName,
      argsJson = argsJson,
      timeoutMs = timeoutMs,
    )
    pendingNativeCalls[callId] = pendingCall
    sendNativeCallEvent(callId, funcName, argsJson)

    val completed = pendingCall.latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    pendingNativeCalls.remove(callId)

    if (!completed) {
      throw IllegalStateException("nativeFunction '$funcName' timeout after ${timeoutMs}ms")
    }
    if (pendingCall.errorMessage != null) {
      throw IllegalStateException(pendingCall.errorMessage ?: "nativeFunction error")
    }
    return pendingCall.resultJson ?: "null"
  }

  private fun sendNativeCallEvent(callId: String, funcName: String, argsJson: String) {
    val params = Arguments.createMap().apply {
      putString("callId", callId)
      putString("funcName", funcName)
      putString("argsJson", argsJson)
    }
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_NATIVE_CALL, params)
  }

  private fun toWritableMap(result: ScriptExecutionResult): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("success", result.success)
      putString("resultJson", result.resultJson)
      if (result.error != null) {
        putString("error", result.error)
      } else {
        putNull("error")
      }
      putDouble("elapsedMs", result.elapsedMs.toDouble())
    }
  }

  private fun toWritableMap(stats: ScriptStats): WritableMap {
    return Arguments.createMap().apply {
      putInt("total", stats.total)
      putInt("success", stats.success)
      putInt("failure", stats.failure)
      putDouble("avgTimeMs", stats.avgTimeMs)
    }
  }
}
