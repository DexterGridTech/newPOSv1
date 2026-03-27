package com.impos2.posadapter.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class ScriptExecutionContext(
    private val executionId: String,
    private val reactContext: ReactApplicationContext,
    private val eventName: String,
) {
    private val engine = QuickJsEngine()
    private val pendingNativeCalls = ConcurrentHashMap<String, CompletableFuture<String>>()

    @Volatile
    private var cancelled = false

    suspend fun execute(
        script: String,
        paramsJson: String,
        globalsJson: String,
        nativeFuncNames: Array<String>,
        timeoutMs: Int,
        bytecode: ByteArray? = null,
    ): String = withContext(Dispatchers.IO) {
        val handle = if (bytecode != null)
            engine.createContextFromBytecode(executionId, bytecode, paramsJson, globalsJson, nativeFuncNames)
        else
            engine.createContext(executionId, script, paramsJson, globalsJson, nativeFuncNames)
        if (handle == 0L) {
            throw ScriptExecutionException(ScriptErrorCode.UNKNOWN, "Failed to create QuickJS context")
        }
        try {
            withTimeout(timeoutMs.toLong()) {
                runPumpLoop(handle, timeoutMs)
            }
        } catch (e: TimeoutCancellationException) {
            engine.interrupt(handle)
            throw ScriptExecutionException(ScriptErrorCode.TIMEOUT, "Script timeout after ${timeoutMs}ms")
        } finally {
            engine.destroyContext(handle)
        }
    }

    private suspend fun runPumpLoop(handle: Long, timeoutMs: Int): String {
        // nativeFunction 子超时：整体超时的一半，最长 3 秒
        val subTimeoutMs = minOf(timeoutMs / 2, 3000).toLong()

        while (true) {
            if (cancelled) {
                throw ScriptExecutionException(ScriptErrorCode.CANCELLED, "Execution cancelled")
            }

            // 1. 取出一个挂起的 nativeCall
            val pendingCall = engine.pollPendingNativeCall(handle)
            if (pendingCall != null) {
                // 关键顺序：先注册 future，再发送事件，避免竞态
                val future = CompletableFuture<String>()
                pendingNativeCalls[pendingCall.callId] = future

                sendNativeCallEvent(pendingCall)

                // 在 IO 线程阻塞等待 Hermes 回调（不阻塞 Hermes JS 线程）
                val result = try {
                    future.get(subTimeoutMs, TimeUnit.MILLISECONDS)
                } catch (e: TimeoutException) {
                    pendingNativeCalls.remove(pendingCall.callId)
                    engine.rejectNativeCall(handle, pendingCall.callId,
                        "nativeFunction '${pendingCall.funcName}' timeout")
                    throw ScriptExecutionException(
                        ScriptErrorCode.NATIVE_CALL_TIMEOUT,
                        "nativeFunction '${pendingCall.funcName}' timeout after ${subTimeoutMs}ms"
                    )
                } catch (e: ExecutionException) {
                    // rejectNativeCall 触发：将错误注入 QuickJS Promise
                    pendingNativeCalls.remove(pendingCall.callId)
                    val msg = e.cause?.message ?: e.message ?: "nativeFunction error"
                    engine.rejectNativeCall(handle, pendingCall.callId, msg)
                    // 继续 pump，让 QuickJS 处理 rejected Promise
                    continue
                }
                pendingNativeCalls.remove(pendingCall.callId)
                engine.resolveNativeCall(handle, pendingCall.callId, result)
                // 继续下一轮，不 delay（可能还有更多 pending call）
                continue
            }

            // 2. 推进 QuickJS 事件循环
            when (engine.pumpState(handle)) {
                PumpState.SETTLED -> return engine.getResult(handle)
                PumpState.ERROR   -> throw ScriptExecutionException(
                    ScriptErrorCode.RUNTIME_ERROR, engine.getError(handle)
                )
                PumpState.PENDING -> delay(1) // 让出协程，避免 CPU 空转
            }
        }
    }

    fun resolveNativeCall(callId: String, resultJson: String) {
        pendingNativeCalls[callId]?.complete(resultJson)
    }

    fun rejectNativeCall(callId: String, error: String) {
        pendingNativeCalls[callId]?.completeExceptionally(RuntimeException(error))
    }

    fun cancel() {
        cancelled = true
        pendingNativeCalls.values.forEach {
            it.completeExceptionally(RuntimeException("Execution cancelled"))
        }
        pendingNativeCalls.clear()
    }

    fun destroy() = engine.close()

    private fun sendNativeCallEvent(call: PendingNativeCall) {
        val params = Arguments.createMap().apply {
            putString("callId", call.callId)
            putString("funcName", call.funcName)
            putString("argsJson", call.argsJson)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
