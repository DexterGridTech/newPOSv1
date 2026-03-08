package com.impos2.posadapter.turbomodules

object ScriptErrorCode {
    const val EMPTY_SCRIPT        = "SCRIPT_001"
    const val TIMEOUT             = "SCRIPT_002"
    const val NATIVE_CALL_TIMEOUT = "SCRIPT_003"
    const val RUNTIME_ERROR       = "SCRIPT_004"
    const val CANCELLED           = "SCRIPT_005"
    const val UNKNOWN             = "SCRIPT_999"
}

class ScriptExecutionException(
    val code: String,
    override val message: String,
    cause: Throwable? = null,
) : Exception(message, cause)
