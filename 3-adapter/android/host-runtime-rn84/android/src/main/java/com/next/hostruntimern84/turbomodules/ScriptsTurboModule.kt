package com.next.hostruntimern84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.next.adapterv2.interfaces.ScriptExecutionOptions
import com.next.adapterv2.interfaces.ScriptExecutionResult
import com.next.adapterv2.interfaces.ScriptStats
import com.next.adapterv2.scripts.ScriptEngineManager
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

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

  private data class ActiveScriptTask(
    val taskId: String,
    val startedAt: Long,
    val promise: Promise,
    val cancelled: AtomicBoolean = AtomicBoolean(false),
  )

  private val scriptEngine by lazy { ScriptEngineManager.getInstance(reactApplicationContext) }
  private val pendingNativeCalls = ConcurrentHashMap<String, PendingNativeCall>()
  private val activeTasks = ConcurrentHashMap<String, ActiveScriptTask>()
  private val taskSequence = AtomicLong(0L)
  private val scriptExecutor: ExecutorService = Executors.newSingleThreadExecutor(ScriptTaskThreadFactory())
  @Volatile private var invalidated = false

  override fun getName(): String = NAME

  override fun executeScript(
    script: String,
    paramsJson: String,
    globalsJson: String,
    nativeFuncNames: ReadableArray,
    timeout: Double,
    promise: Promise,
  ) {
    if (invalidated) {
      rejectPromise(promise, "EXECUTE_SCRIPT_ERROR", "ScriptsTurboModule invalidated")
      return
    }

    val taskId = "task-${taskSequence.incrementAndGet()}"
    val task = ActiveScriptTask(
      taskId = taskId,
      startedAt = System.currentTimeMillis(),
      promise = promise,
    )
    activeTasks[taskId] = task

    runCatching {
      val names = List(nativeFuncNames.size()) { index -> nativeFuncNames.getString(index).orEmpty() }
      scriptExecutor.execute {
        if (task.cancelled.get() || invalidated) {
          activeTasks.remove(taskId)
          return@execute
        }

        runCatching {
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
            ),
          )
          toWritableMap(result)
        }.onSuccess { resultMap ->
          if (!task.cancelled.get() && !invalidated) {
            resolvePromise(task.promise, resultMap)
          }
        }.onFailure { error ->
          if (!task.cancelled.get() && !invalidated) {
            rejectPromise(task.promise, "EXECUTE_SCRIPT_ERROR", error.message, error)
          }
        }

        activeTasks.remove(taskId)
      }
    }.onFailure { error ->
      activeTasks.remove(taskId)
      rejectPromise(promise, "EXECUTE_SCRIPT_ERROR", error.message, error)
    }
  }

  override fun resolveNativeCall(callId: String, resultJson: String, promise: Promise) {
    pendingNativeCalls.remove(callId)?.apply {
      this.resultJson = resultJson
      latch.countDown()
    }
    resolvePromise(promise, null)
  }

  override fun rejectNativeCall(callId: String, errorMessage: String, promise: Promise) {
    pendingNativeCalls.remove(callId)?.apply {
      this.errorMessage = errorMessage
      latch.countDown()
    }
    resolvePromise(promise, null)
  }

  override fun getStats(promise: Promise) {
    runCatching {
      toWritableMap(scriptEngine.getStats())
    }.onSuccess {
      resolvePromise(promise, it)
    }.onFailure {
      rejectPromise(promise, "GET_SCRIPT_STATS_ERROR", it.message, it)
    }
  }

  override fun clearStats() {
    scriptEngine.clearStats()
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  override fun invalidate() {
    invalidated = true
    activeTasks.values.forEach { task ->
      task.cancelled.set(true)
      rejectPromise(task.promise, "EXECUTE_SCRIPT_ERROR", "ScriptsTurboModule invalidated")
    }
    activeTasks.clear()
    pendingNativeCalls.forEach { (_, pendingCall) ->
      pendingCall.errorMessage = "ScriptsTurboModule invalidated"
      pendingCall.latch.countDown()
    }
    pendingNativeCalls.clear()
    scriptExecutor.shutdownNow()
    super.invalidate()
  }

  private fun invokeNativeFunction(funcName: String, argsJson: String, timeoutMs: Long): String {
    if (invalidated) {
      throw IllegalStateException("ScriptsTurboModule invalidated")
    }

    val callId = "${System.currentTimeMillis()}:${System.nanoTime()}"
    val pendingCall = PendingNativeCall(
      funcName = funcName,
      argsJson = argsJson,
      timeoutMs = timeoutMs,
    )
    pendingNativeCalls[callId] = pendingCall
    sendNativeCallEvent(callId, funcName, argsJson)

    val completed = try {
      pendingCall.latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    } catch (error: InterruptedException) {
      Thread.currentThread().interrupt()
      pendingCall.errorMessage = "nativeFunction '$funcName' interrupted"
      true
    } finally {
      pendingNativeCalls.remove(callId)
    }

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

  private fun resolvePromise(promise: Promise, value: Any?) {
    reactApplicationContext.runOnNativeModulesQueueThread {
      promise.resolve(value)
    }
  }

  private fun rejectPromise(
    promise: Promise,
    code: String,
    message: String?,
    throwable: Throwable? = null,
  ) {
    reactApplicationContext.runOnNativeModulesQueueThread {
      if (throwable != null) {
        promise.reject(code, message, throwable)
      } else {
        promise.reject(code, message)
      }
    }
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

  private class ScriptTaskThreadFactory : ThreadFactory {
    private val sequence = AtomicLong(0L)

    override fun newThread(runnable: Runnable): Thread {
      return Thread(runnable, "host-runtime-rn84-scripts-${sequence.incrementAndGet()}").apply {
        isDaemon = true
      }
    }
  }
}
