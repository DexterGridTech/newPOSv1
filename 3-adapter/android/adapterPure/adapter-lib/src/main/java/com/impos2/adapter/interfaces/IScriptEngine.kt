package com.impos2.adapter.interfaces

interface IScriptEngine {
  fun executeScript(options: ScriptExecutionOptions): ScriptExecutionResult
  fun getStats(): ScriptStats
  fun clearStats()
}
