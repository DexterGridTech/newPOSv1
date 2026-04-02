package com.impos2.adapter.interfaces

/**
 * native function 调用桥。
 *
 * 脚本运行时如果需要回调宿主原生能力，会通过这个函数式接口向外发起调用。
 */
fun interface NativeFunctionInvoker {
  fun invoke(funcName: String, argsJson: String, timeoutMs: Long): String
}

/**
 * 单次脚本执行的输入参数。
 */
data class ScriptExecutionOptions(
  val script: String,
  val paramsJson: String = "{}",
  val globalsJson: String = "{}",
  val nativeFuncNames: Array<String> = emptyArray(),
  val timeout: Int = 5000,
  val nativeFunctionInvoker: NativeFunctionInvoker? = null
)

/**
 * 单次脚本执行结果。
 */
data class ScriptExecutionResult(
  val success: Boolean,
  val resultJson: String,
  val error: String? = null,
  val elapsedMs: Long = 0
)

/**
 * 脚本执行统计信息。
 */
data class ScriptStats(
  val total: Int,
  val success: Int,
  val failure: Int,
  val avgTimeMs: Double
)
