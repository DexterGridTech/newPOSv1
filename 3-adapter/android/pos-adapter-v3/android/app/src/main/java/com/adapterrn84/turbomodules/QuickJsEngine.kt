package com.adapterrn84.turbomodules

import java.io.Closeable

enum class PumpState { PENDING, SETTLED, ERROR }

data class PendingNativeCall(
    val callId: String,
    val funcName: String,
    val argsJson: String,
)

class QuickJsEngine : Closeable {

    companion object {
        init { System.loadLibrary("quickjs_bridge") }
    }

    external fun createContext(
        executionId: String,
        script: String,
        paramsJson: String,
        globalsJson: String,
        nativeFuncNames: Array<String>,
    ): Long

    external fun pumpEventLoop(handle: Long): Int
    external fun pollPendingNativeCall(handle: Long): PendingNativeCall?
    external fun resolveNativeCall(handle: Long, callId: String, resultJson: String)
    external fun rejectNativeCall(handle: Long, callId: String, error: String)
    external fun getResult(handle: Long): String
    external fun getError(handle: Long): String
    external fun interrupt(handle: Long)
    external fun destroyContext(handle: Long)
    external fun compileScript(script: String): ByteArray?

    external fun createContextFromBytecode(
        executionId: String,
        bytecode: ByteArray,
        paramsJson: String,
        globalsJson: String,
        nativeFuncNames: Array<String>,
    ): Long

    fun pumpState(handle: Long): PumpState = when (pumpEventLoop(handle)) {
        1    -> PumpState.SETTLED
        -1   -> PumpState.ERROR
        else -> PumpState.PENDING
    }

    override fun close() {}
}
