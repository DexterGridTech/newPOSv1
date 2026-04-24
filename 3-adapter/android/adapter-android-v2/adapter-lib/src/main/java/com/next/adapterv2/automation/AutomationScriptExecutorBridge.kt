package com.next.adapterv2.automation

import com.next.adapterv2.interfaces.IScriptEngine
import com.next.adapterv2.interfaces.ScriptExecutionOptions
import com.next.adapterv2.interfaces.ScriptExecutionResult
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

