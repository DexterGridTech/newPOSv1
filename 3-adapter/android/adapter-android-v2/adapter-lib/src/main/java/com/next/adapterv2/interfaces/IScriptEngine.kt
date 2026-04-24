package com.next.adapterv2.interfaces

/**
 * 脚本执行能力抽象。
 *
 * 上层通过这个接口执行脚本、读取统计，并在必要时清理统计状态。
 */
interface IScriptEngine {
  fun executeScript(options: ScriptExecutionOptions): ScriptExecutionResult
  fun getStats(): ScriptStats
  fun clearStats()
}
