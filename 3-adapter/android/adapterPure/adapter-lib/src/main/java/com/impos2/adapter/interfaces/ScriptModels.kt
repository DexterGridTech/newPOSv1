package com.impos2.adapter.interfaces

fun interface NativeFunctionInvoker {
  fun invoke(funcName: String, argsJson: String, timeoutMs: Long): String
}

data class ScriptExecutionOptions(
  val script: String,
  val paramsJson: String = "{}",
  val globalsJson: String = "{}",
  val nativeFuncNames: Array<String> = emptyArray(),
  val timeout: Int = 5000,
  val nativeFunctionInvoker: NativeFunctionInvoker? = null
)

data class ScriptExecutionResult(
  val success: Boolean,
  val resultJson: String,
  val error: String? = null,
  val elapsedMs: Long = 0
)

data class ScriptStats(
  val total: Int,
  val success: Int,
  val failure: Int,
  val avgTimeMs: Double
)
