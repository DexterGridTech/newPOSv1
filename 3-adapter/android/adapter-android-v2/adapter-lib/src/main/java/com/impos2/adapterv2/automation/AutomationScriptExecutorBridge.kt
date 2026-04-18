package com.impos2.adapterv2.automation

import com.impos2.adapterv2.interfaces.IScriptEngine
import com.impos2.adapterv2.interfaces.ScriptExecutionOptions
import com.impos2.adapterv2.interfaces.ScriptExecutionResult
import org.json.JSONObject

class AutomationScriptExecutorBridge(
  private val scriptEngine: IScriptEngine,
) {
  fun execute(inputJson: String): ScriptExecutionResult {
    val input = if (inputJson.isBlank()) JSONObject() else JSONObject(inputJson)
    return scriptEngine.executeScript(
      ScriptExecutionOptions(
        script = input.optString("source"),
        paramsJson = input.optJSONObject("params")?.toString() ?: "{}",
        globalsJson = input.optJSONObject("globals")?.toString() ?: "{}",
        timeout = input.optInt("timeoutMs", 5_000),
      ),
    )
  }
}

