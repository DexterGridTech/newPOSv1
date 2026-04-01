package com.impos2.adapter.scripts

import android.content.Context
import com.impos2.adapter.interfaces.IScriptEngine
import com.impos2.adapter.interfaces.ScriptExecutionOptions
import com.impos2.adapter.interfaces.ScriptExecutionResult
import com.impos2.adapter.interfaces.ScriptStats
import com.whl.quickjs.android.QuickJSLoader
import com.whl.quickjs.wrapper.JSCallFunction
import com.whl.quickjs.wrapper.QuickJSContext
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

class ScriptEngineManager private constructor(private val context: Context) : IScriptEngine {

  companion object {
    @Volatile
    private var instance: ScriptEngineManager? = null

    init {
      QuickJSLoader.init()
    }

    fun getInstance(context: Context): ScriptEngineManager =
      instance ?: synchronized(this) {
        instance ?: ScriptEngineManager(context.applicationContext).also { instance = it }
      }
  }

  private val totalCount = AtomicInteger(0)
  private val successCount = AtomicInteger(0)
  private val failureCount = AtomicInteger(0)
  private val totalTimeMs = AtomicLong(0)

  override fun executeScript(options: ScriptExecutionOptions): ScriptExecutionResult {
    if (options.script.isBlank()) {
      record(0, false)
      return ScriptExecutionResult(success = false, resultJson = "null", error = "Script cannot be empty")
    }

    val started = System.currentTimeMillis()
    var ctx: QuickJSContext? = null
    return try {
      ctx = QuickJSContext.create()
      ctx.evaluate("globalThis.__params = ${options.paramsJson};")
      ctx.evaluate("globalThis.__globals = ${options.globalsJson};")

      options.nativeFuncNames.forEach { funcName ->
        val safeName = funcName.replace("'", "")
        ctx?.getGlobalObject()?.setProperty(safeName, object : JSCallFunction {
          override fun call(vararg args: Any?): Any? {
            val invoker = options.nativeFunctionInvoker ?: return null
            val argsJson = argsToJson(args)
            val resultJson = invoker.invoke(safeName, argsJson, options.timeout.toLong())
            return parseJsonLiteral(resultJson)
          }
        })
      }

      val wrappedScript = """
        (function() {
          const params = globalThis.__params;
          const globals = globalThis.__globals;
          Object.keys(globals || {}).forEach(function(k){ globalThis[k] = globals[k]; });
          const result = (function(){ ${options.script} })();
          return JSON.stringify(result);
        })()
      """.trimIndent()

      val value = ctx.evaluate(wrappedScript)
      val elapsed = System.currentTimeMillis() - started
      record(elapsed, true)
      ScriptExecutionResult(
        success = true,
        resultJson = value?.toString() ?: "null",
        elapsedMs = elapsed
      )
    } catch (e: Exception) {
      val elapsed = System.currentTimeMillis() - started
      record(elapsed, false)
      ScriptExecutionResult(
        success = false,
        resultJson = "null",
        error = e.message ?: "Unknown error",
        elapsedMs = elapsed
      )
    } finally {
      try {
        ctx?.destroy()
      } catch (_: Exception) {
      }
    }
  }

  override fun getStats(): ScriptStats {
    val total = totalCount.get()
    return ScriptStats(
      total = total,
      success = successCount.get(),
      failure = failureCount.get(),
      avgTimeMs = if (total > 0) totalTimeMs.get().toDouble() / total else 0.0
    )
  }

  override fun clearStats() {
    totalCount.set(0)
    successCount.set(0)
    failureCount.set(0)
    totalTimeMs.set(0)
  }

  private fun record(elapsed: Long, success: Boolean) {
    totalCount.incrementAndGet()
    if (success) {
      successCount.incrementAndGet()
    } else {
      failureCount.incrementAndGet()
    }
    totalTimeMs.addAndGet(elapsed)
  }

  private fun argsToJson(args: Array<out Any?>): String {
    return args.joinToString(separator = ",", prefix = "[", postfix = "]") { value ->
      toJsonLiteral(value)
    }
  }

  private fun toJsonLiteral(value: Any?): String {
    return when (value) {
      null -> "null"
      is String -> "\"${value.escapeJson()}\""
      is Number, is Boolean -> value.toString()
      else -> "\"${value.toString().escapeJson()}\""
    }
  }

  private fun parseJsonLiteral(value: String): Any? {
    return when {
      value == "null" -> null
      value == "true" -> true
      value == "false" -> false
      value.startsWith("\"") && value.endsWith("\"") && value.length >= 2 ->
        value.substring(1, value.length - 1)
      value.contains('.') -> value.toDoubleOrNull() ?: value
      else -> value.toLongOrNull() ?: value
    }
  }

  private fun String.escapeJson(): String {
    return buildString(length + 8) {
      this@escapeJson.forEach { ch ->
        when (ch) {
          '\\' -> append("\\\\")
          '"' -> append("\\\"")
          '\n' -> append("\\n")
          '\r' -> append("\\r")
          '\t' -> append("\\t")
          else -> append(ch)
        }
      }
    }
  }
}
