package com.adapterrn84.turbomodules.scripts

import com.whl.quickjs.android.QuickJSLoader
import com.whl.quickjs.wrapper.QuickJSContext
import java.io.Closeable

enum class PumpState { PENDING, SETTLED, ERROR }

data class PendingNativeCall(
    val callId: String,
    val funcName: String,
    val argsJson: String,
)

class QuickJsEngine : Closeable {
    companion object {
        init {
            QuickJSLoader.init()
        }
    }

    private val contexts = mutableMapOf<Long, QuickJsContext>()
    private var nextHandle = 1L

    data class QuickJsContext(
        val context: QuickJSContext,
        val pendingCalls: MutableList<PendingNativeCall> = mutableListOf(),
        var result: String? = null,
        var error: String? = null,
        var settled: Boolean = false,
    )

    fun createContext(
        executionId: String,
        script: String,
        paramsJson: String,
        globalsJson: String,
        nativeFuncNames: Array<String>,
    ): Long {
        val handle = nextHandle++
        val context = QuickJSContext.create()

        try {
            // 注入 params 和 globals
            context.evaluate("globalThis.__params = $paramsJson;")
            context.evaluate("globalThis.__globals = $globalsJson;")

            // 注册 nativeFunction 桩
            nativeFuncNames.forEach { funcName ->
                context.getGlobalObject().setProperty(funcName, object : com.whl.quickjs.wrapper.JSCallFunction {
                    override fun call(vararg args: Any?): Any {
                        val callId = "$executionId:${System.nanoTime()}"
                        val argsJson = args.joinToString(",", "[", "]") {
                            when (it) {
                                null -> "null"
                                is String -> "\"${it.replace("\"", "\\\"")}\""
                                is Number -> it.toString()
                                is Boolean -> it.toString()
                                else -> "\"$it\""
                            }
                        }
                        contexts[handle]?.pendingCalls?.add(
                            PendingNativeCall(callId, funcName, argsJson)
                        )
                        return "__PENDING__$callId"
                    }
                })
            }

            contexts[handle] = QuickJsContext(context)

            // 执行脚本（包装成立即执行函数，注入 params 和解构 globals，返回 JSON）
            val wrappedScript = """
                (function() {
                    const params = globalThis.__params;
                    const {...globals} = globalThis.__globals;
                    for(let k in globals) { eval(`var ${'$'}{k} = globals[k]`); }
                    const result = (function() { $script })();
                    return JSON.stringify(result);
                })()
            """.trimIndent()
            val result = context.evaluate(wrappedScript)
            contexts[handle]?.result = result?.toString() ?: "null"
            contexts[handle]?.settled = true
        } catch (e: Exception) {
            contexts[handle]?.error = e.message ?: "Unknown error"
        }

        return handle
    }

    fun pumpEventLoop(handle: Long): Int {
        val ctx = contexts[handle] ?: return -1
        return when {
            ctx.error != null -> -1
            ctx.settled -> 1
            else -> 0
        }
    }

    fun pollPendingNativeCall(handle: Long): PendingNativeCall? {
        return contexts[handle]?.pendingCalls?.removeFirstOrNull()
    }

    fun resolveNativeCall(handle: Long, callId: String, resultJson: String) {
        // HarlonWang quickjs-wrapper 不支持异步 Promise，简化处理
    }

    fun rejectNativeCall(handle: Long, callId: String, error: String) {
        // HarlonWang quickjs-wrapper 不支持异步 Promise，简化处理
    }

    fun getResult(handle: Long): String {
        return contexts[handle]?.result ?: "null"
    }

    fun getError(handle: Long): String {
        return contexts[handle]?.error ?: "Unknown error"
    }

    fun interrupt(handle: Long) {
        contexts[handle]?.context?.destroy()
    }

    fun destroyContext(handle: Long) {
        contexts.remove(handle)?.context?.destroy()
    }

    fun pumpState(handle: Long): PumpState = when (pumpEventLoop(handle)) {
        1 -> PumpState.SETTLED
        -1 -> PumpState.ERROR
        else -> PumpState.PENDING
    }

    override fun close() {
        contexts.values.forEach { it.context.destroy() }
        contexts.clear()
    }
}
