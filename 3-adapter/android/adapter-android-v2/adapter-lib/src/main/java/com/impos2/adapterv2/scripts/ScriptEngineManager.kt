package com.impos2.adapterv2.scripts

import android.content.Context
import android.util.Log
import com.impos2.adapterv2.interfaces.IScriptEngine
import com.impos2.adapterv2.interfaces.ScriptExecutionOptions
import com.impos2.adapterv2.interfaces.ScriptExecutionResult
import com.impos2.adapterv2.interfaces.ScriptStats
import com.whl.quickjs.android.QuickJSLoader
import com.whl.quickjs.wrapper.JSCallFunction
import com.whl.quickjs.wrapper.QuickJSContext
import java.security.MessageDigest
import java.util.LinkedHashMap
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * 脚本执行引擎管理器。
 *
 * 这是 adapterPure 中最敏感的模块之一，目标不是“能执行脚本”这么简单，而是要在生产环境下做到：
 * - 单次执行可控；
 * - 超时后能隔离污染并重建 runtime；
 * - native function 回调可诊断；
 * - 高频重复脚本有缓存收益；
 * - 单个问题脚本不要拖垮整个宿主。
 *
 * 当前实现采用“单线程 runtime + 受控重建”模型：
 * - 一个 runtime 只绑定一个单线程 executor；
 * - 出现 timeout / poison / native call 失控后，直接回收并创建新 runtime；
 * - 通过 bytecode cache 降低重复编译开销。
 */
class ScriptEngineManager private constructor(private val context: Context) : IScriptEngine {

  private enum class ExecutionState {
    PENDING,
    RUNNING,
    WAITING_NATIVE_CALLBACK,
    SUCCEEDED,
    FAILED,
    TIMED_OUT,
  }

  private data class ScriptExecutionContext(
    val executionId: String,
    val scriptHash: String,
    val scriptPreview: String,
    val timeoutMs: Int,
    val startedAt: Long,
    val nativeFuncNames: List<String>,
    @Volatile var state: ExecutionState = ExecutionState.PENDING,
    @Volatile var nativeCallCount: Int = 0,
    @Volatile var lastNativeCallName: String? = null,
    @Volatile var lastNativeCallAt: Long = 0L,
    @Volatile var errorMessage: String? = null,
    @Volatile var elapsedMs: Long = 0L,
    @Volatile var runtimeId: String? = null,
    @Volatile var compileCacheHit: Boolean = false,
  )

  private data class CompiledScript(
    val cacheKey: String,
    val bytecode: ByteArray,
    val compiledAt: Long = System.currentTimeMillis(),
  )

  private class ScriptBytecodeCache(private val maxEntries: Int) {
    private val lock = Any()
    private val hitCount = AtomicLong(0L)
    private val missCount = AtomicLong(0L)
    private val putCount = AtomicLong(0L)
    private val evictionCount = AtomicLong(0L)
    private val map = object : LinkedHashMap<String, CompiledScript>(maxEntries, 0.75f, true) {
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CompiledScript>?): Boolean {
        val shouldRemove = size > maxEntries
        if (shouldRemove) {
          evictionCount.incrementAndGet()
        }
        return shouldRemove
      }
    }

    fun get(cacheKey: String): CompiledScript? = synchronized(lock) {
      val value = map[cacheKey]
      if (value == null) {
        missCount.incrementAndGet()
      } else {
        hitCount.incrementAndGet()
      }
      value
    }

    fun put(cacheKey: String, script: CompiledScript) = synchronized(lock) {
      map[cacheKey] = script
      putCount.incrementAndGet()
    }

    fun clear() = synchronized(lock) {
      map.clear()
      hitCount.set(0L)
      missCount.set(0L)
      putCount.set(0L)
      evictionCount.set(0L)
    }

    fun dumpState(): String = synchronized(lock) {
      buildString {
        append("size=")
        append(map.size)
        append(", hits=")
        append(hitCount.get())
        append(", misses=")
        append(missCount.get())
        append(", puts=")
        append(putCount.get())
        append(", evictions=")
        append(evictionCount.get())
      }
    }
  }

  private class ScriptExecutionRuntime(
    val runtimeId: String,
    private val executor: ExecutorService,
  ) {
    private val createdAt = System.currentTimeMillis()
    private val submittedCount = AtomicLong(0L)
    private val completedCount = AtomicLong(0L)
    private val failedCount = AtomicLong(0L)
    private val timeoutCount = AtomicLong(0L)
    private val poisoned = AtomicBoolean(false)
    @Volatile private var lastSubmittedAt: Long = 0L
    @Volatile private var lastCompletedAt: Long = 0L
    @Volatile private var poisonedAt: Long = 0L
    @Volatile private var poisonReason: String? = null

    fun <T> submit(task: Callable<T>): Future<T> {
      submittedCount.incrementAndGet()
      lastSubmittedAt = System.currentTimeMillis()
      return executor.submit(task)
    }

    fun onCompleted(success: Boolean) {
      completedCount.incrementAndGet()
      lastCompletedAt = System.currentTimeMillis()
      if (!success) {
        failedCount.incrementAndGet()
      }
    }

    fun onTimeout() {
      timeoutCount.incrementAndGet()
      completedCount.incrementAndGet()
      lastCompletedAt = System.currentTimeMillis()
      failedCount.incrementAndGet()
    }

    fun poison(reason: String) {
      if (poisoned.compareAndSet(false, true)) {
        poisonReason = reason
        poisonedAt = System.currentTimeMillis()
      }
    }

    fun isPoisoned(): Boolean = poisoned.get()

    fun shutdownNow() {
      executor.shutdownNow()
    }

    fun dumpState(): String {
      return buildString {
        append("runtimeId=")
        append(runtimeId)
        append(", createdAt=")
        append(createdAt)
        append(", submitted=")
        append(submittedCount.get())
        append(", completed=")
        append(completedCount.get())
        append(", failed=")
        append(failedCount.get())
        append(", timedOut=")
        append(timeoutCount.get())
        append(", poisoned=")
        append(poisoned.get())
        append(", poisonedAt=")
        append(poisonedAt)
        append(", poisonReason=")
        append(poisonReason ?: "null")
        append(", lastSubmittedAt=")
        append(lastSubmittedAt)
        append(", lastCompletedAt=")
        append(lastCompletedAt)
      }
    }
  }

  companion object {
    private const val TAG = "ScriptEngineManager"
    private const val MAX_SCRIPT_LENGTH = 256 * 1024
    private const val MAX_TIMEOUT_MS = 60_000
    private const val BYTECODE_CACHE_SIZE = 64

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

  // 保护 runtime 的创建、回收与替换，确保任何时刻只有一个活跃 runtime 被对外使用。
  private val runtimeLock = Any()
  // 字节码缓存只服务于重复脚本，目标是降低编译成本，而不是跨版本长期持久化。
  private val bytecodeCache = ScriptBytecodeCache(BYTECODE_CACHE_SIZE)
  private val totalCount = AtomicInteger(0)
  private val successCount = AtomicInteger(0)
  private val failureCount = AtomicInteger(0)
  private val totalTimeMs = AtomicLong(0)
  private val runningCount = AtomicInteger(0)
  private val maxConcurrentCount = AtomicInteger(0)
  private val timeoutCount = AtomicInteger(0)
  private val nativeCallCount = AtomicInteger(0)
  private val nativeCallFailureCount = AtomicInteger(0)
  private val nativeCallTimeoutCount = AtomicInteger(0)
  private val lastElapsedMs = AtomicLong(0)
  private val lastExecutedAt = AtomicLong(0)
  private val lastFailedAt = AtomicLong(0)
  private val runtimeRecycleCount = AtomicLong(0L)
  private val compileCacheCompileCount = AtomicLong(0L)
  private val compileCacheFallbackCount = AtomicLong(0L)
  private val executionSequence = AtomicLong(0L)
  private val runtimeSequence = AtomicLong(0L)

  @Volatile private var runtime: ScriptExecutionRuntime = createRuntime()
  @Volatile private var activeExecution: ScriptExecutionContext? = null
  @Volatile private var lastScriptPreview: String = "--"
  @Volatile private var lastError: String? = null
  @Volatile private var lastResultPreview: String = "--"

  override fun executeScript(options: ScriptExecutionOptions): ScriptExecutionResult {
    val validationError = validate(options)
    if (validationError != null) {
      val invalidContext = createExecutionContext(options)
      record(
        context = invalidContext,
        elapsed = 0,
        success = false,
        resultJson = "null",
        error = validationError,
        forcedState = ExecutionState.FAILED,
      )
      return ScriptExecutionResult(success = false, resultJson = "null", error = validationError)
    }

    val executionContext = createExecutionContext(options)
    val currentRunning = runningCount.incrementAndGet()
    updateMaxConcurrent(currentRunning)
    activeExecution = executionContext

    val currentRuntime = getHealthyRuntime()
    executionContext.runtimeId = currentRuntime.runtimeId

    return try {
      val task = currentRuntime.submit(Callable {
        executeInRuntime(executionContext, options)
      })
      val result = waitForResult(task, currentRuntime, executionContext)
      currentRuntime.onCompleted(result.success)
      result
    } catch (error: TimeoutException) {
      currentRuntime.onTimeout()
      recycleRuntime(currentRuntime, "script timeout: ${executionContext.executionId}")
      val elapsed = System.currentTimeMillis() - executionContext.startedAt
      val message = "script timeout after ${executionContext.timeoutMs}ms"
      timeoutCount.incrementAndGet()
      record(
        context = executionContext,
        elapsed = elapsed,
        success = false,
        resultJson = "null",
        error = message,
        forcedState = ExecutionState.TIMED_OUT,
      )
      ScriptExecutionResult(
        success = false,
        resultJson = "null",
        error = message,
        elapsedMs = elapsed,
      )
    } catch (error: Exception) {
      currentRuntime.onCompleted(false)
      val message = error.message ?: "Unknown error"
      if (message.contains("timeout", ignoreCase = true)) {
        timeoutCount.incrementAndGet()
      }
      val elapsed = System.currentTimeMillis() - executionContext.startedAt
      record(
        context = executionContext,
        elapsed = elapsed,
        success = false,
        resultJson = "null",
        error = message,
        forcedState = ExecutionState.FAILED,
      )
      ScriptExecutionResult(
        success = false,
        resultJson = "null",
        error = message,
        elapsedMs = elapsed,
      )
    } finally {
      runningCount.updateAndGet { current -> if (current > 0) current - 1 else 0 }
      if (activeExecution?.executionId == executionContext.executionId) {
        activeExecution = null
      }
    }
  }

  override fun getStats(): ScriptStats {
    val total = totalCount.get()
    return ScriptStats(
      total = total,
      success = successCount.get(),
      failure = failureCount.get(),
      avgTimeMs = if (total > 0) totalTimeMs.get().toDouble() / total else 0.0,
    )
  }

  override fun clearStats() {
    totalCount.set(0)
    successCount.set(0)
    failureCount.set(0)
    totalTimeMs.set(0)
    runningCount.set(0)
    maxConcurrentCount.set(0)
    timeoutCount.set(0)
    nativeCallCount.set(0)
    nativeCallFailureCount.set(0)
    nativeCallTimeoutCount.set(0)
    lastElapsedMs.set(0)
    lastExecutedAt.set(0)
    lastFailedAt.set(0)
    runtimeRecycleCount.set(0L)
    compileCacheCompileCount.set(0L)
    compileCacheFallbackCount.set(0L)
    lastScriptPreview = "--"
    lastError = null
    lastResultPreview = "--"
    activeExecution = null
    bytecodeCache.clear()
  }

  fun dumpState(): String {
    val active = activeExecution
    return buildString {
      append("running=")
      append(runningCount.get())
      append(", maxConcurrent=")
      append(maxConcurrentCount.get())
      append(", total=")
      append(totalCount.get())
      append(", success=")
      append(successCount.get())
      append(", failure=")
      append(failureCount.get())
      append(", timeouts=")
      append(timeoutCount.get())
      append(", runtimeRecycles=")
      append(runtimeRecycleCount.get())
      append(", bytecodeCompiles=")
      append(compileCacheCompileCount.get())
      append(", bytecodeFallbacks=")
      append(compileCacheFallbackCount.get())
      append(", nativeCalls=")
      append(nativeCallCount.get())
      append(", nativeCallFailures=")
      append(nativeCallFailureCount.get())
      append(", nativeCallTimeouts=")
      append(nativeCallTimeoutCount.get())
      append(", avgTimeMs=")
      append(if (totalCount.get() > 0) totalTimeMs.get().toDouble() / totalCount.get() else 0.0)
      append(", lastElapsedMs=")
      append(lastElapsedMs.get())
      append(", lastExecutedAt=")
      append(lastExecutedAt.get())
      append(", lastFailedAt=")
      append(lastFailedAt.get())
      append(", lastScript=")
      append(lastScriptPreview)
      append(", lastResult=")
      append(lastResultPreview)
      append(", lastError=")
      append(lastError ?: "null")
      append(", runtime=")
      append(runtime.dumpState())
      append(", bytecodeCache=")
      append(bytecodeCache.dumpState())
      append(", activeExecution=")
      append(active?.let { dumpExecutionContext(it) } ?: "null")
    }
  }

  private fun executeInRuntime(
    executionContext: ScriptExecutionContext,
    options: ScriptExecutionOptions,
  ): ScriptExecutionResult {
    var contextRef: QuickJSContext? = null
    return try {
      executionContext.state = ExecutionState.RUNNING
      contextRef = QuickJSContext.create()
      seedGlobalJson(contextRef, "__paramsJson", options.paramsJson)
      seedGlobalJson(contextRef, "__globalsJson", options.globalsJson)
      seedGlobalJson(contextRef, "__nativeFuncNames", toJsonArray(options.nativeFuncNames))

      options.nativeFuncNames.distinct().forEach { funcName ->
        val safeName = funcName.trim().replace("'", "")
        if (safeName.isEmpty()) return@forEach
        contextRef.getGlobalObject()?.setProperty(safeName, object : JSCallFunction {
          override fun call(vararg args: Any?): Any? {
            val invoker = options.nativeFunctionInvoker ?: return null
            val argsJson = argsToJson(args)
            nativeCallCount.incrementAndGet()
            executionContext.nativeCallCount += 1
            executionContext.lastNativeCallName = safeName
            executionContext.lastNativeCallAt = System.currentTimeMillis()
            executionContext.state = ExecutionState.WAITING_NATIVE_CALLBACK
            return try {
              val resultJson = invoker.invoke(safeName, argsJson, executionContext.timeoutMs.toLong())
              executionContext.state = ExecutionState.RUNNING
              parseJsonLiteral(resultJson)
            } catch (error: Exception) {
              executionContext.state = ExecutionState.FAILED
              nativeCallFailureCount.incrementAndGet()
              if ((error.message ?: "").contains("timeout", ignoreCase = true)) {
                nativeCallTimeoutCount.incrementAndGet()
              }
              throw error
            }
          }
        })
      }

      val wrappedScript = buildWrappedScript(options.script)
      val resultValue = evaluateWithBytecodeCache(contextRef, wrappedScript, executionContext)
      val elapsed = System.currentTimeMillis() - executionContext.startedAt
      val resultJson = resultValue?.toString() ?: "null"
      record(
        context = executionContext,
        elapsed = elapsed,
        success = true,
        resultJson = resultJson,
        error = null,
        forcedState = ExecutionState.SUCCEEDED,
      )
      ScriptExecutionResult(
        success = true,
        resultJson = resultJson,
        elapsedMs = elapsed,
      )
    } catch (error: Exception) {
      val elapsed = System.currentTimeMillis() - executionContext.startedAt
      val message = error.message ?: "Unknown error"
      if (message.contains("timeout", ignoreCase = true)) {
        timeoutCount.incrementAndGet()
      }
      record(
        context = executionContext,
        elapsed = elapsed,
        success = false,
        resultJson = "null",
        error = message,
        forcedState = ExecutionState.FAILED,
      )
      ScriptExecutionResult(
        success = false,
        resultJson = "null",
        error = message,
        elapsedMs = elapsed,
      )
    } finally {
      try {
        contextRef?.destroy()
      } catch (destroyError: Exception) {
        Log.w(TAG, "QuickJSContext destroy failed", destroyError)
      }
    }
  }

  private fun evaluateWithBytecodeCache(
    contextRef: QuickJSContext,
    wrappedScript: String,
    executionContext: ScriptExecutionContext,
  ): Any? {
    val cacheKey = sha256(wrappedScript)
    val cached = bytecodeCache.get(cacheKey)
    if (cached != null) {
      executionContext.compileCacheHit = true
      return contextRef.execute(cached.bytecode)
    }

    return try {
      val bytecode = contextRef.compile(wrappedScript)
      bytecodeCache.put(cacheKey, CompiledScript(cacheKey = cacheKey, bytecode = bytecode))
      compileCacheCompileCount.incrementAndGet()
      contextRef.execute(bytecode)
    } catch (compileError: Exception) {
      compileCacheFallbackCount.incrementAndGet()
      Log.w(TAG, "bytecode compile/execute failed, fallback to evaluate", compileError)
      contextRef.evaluate(wrappedScript)
    }
  }

  private fun waitForResult(
    task: Future<ScriptExecutionResult>,
    currentRuntime: ScriptExecutionRuntime,
    executionContext: ScriptExecutionContext,
  ): ScriptExecutionResult {
    return try {
      task.get(executionContext.timeoutMs.toLong(), TimeUnit.MILLISECONDS)
    } catch (timeout: TimeoutException) {
      task.cancel(true)
      currentRuntime.poison("script timeout")
      throw timeout
    }
  }

  private fun getHealthyRuntime(): ScriptExecutionRuntime {
    val current = runtime
    if (!current.isPoisoned()) {
      return current
    }
    synchronized(runtimeLock) {
      val latest = runtime
      if (!latest.isPoisoned()) {
        return latest
      }
      val next = createRuntime()
      runtime = next
      runtimeRecycleCount.incrementAndGet()
      return next
    }
  }

  private fun recycleRuntime(currentRuntime: ScriptExecutionRuntime, reason: String) {
    currentRuntime.poison(reason)
    synchronized(runtimeLock) {
      if (runtime === currentRuntime) {
        runtime = createRuntime()
        runtimeRecycleCount.incrementAndGet()
      }
    }
    currentRuntime.shutdownNow()
  }

  private fun createExecutionContext(options: ScriptExecutionOptions): ScriptExecutionContext {
    val executionId = "exec-${executionSequence.incrementAndGet()}"
    return ScriptExecutionContext(
      executionId = executionId,
      scriptHash = sha256(options.script),
      scriptPreview = options.script.replace('\n', ' ').take(160),
      timeoutMs = options.timeout.coerceIn(1, MAX_TIMEOUT_MS),
      startedAt = System.currentTimeMillis(),
      nativeFuncNames = options.nativeFuncNames.distinct(),
    )
  }

  private fun createRuntime(): ScriptExecutionRuntime {
    val runtimeId = "runtime-${runtimeSequence.incrementAndGet()}"
    val executor = Executors.newSingleThreadExecutor(ScriptThreadFactory(runtimeId))
    return ScriptExecutionRuntime(runtimeId = runtimeId, executor = executor)
  }

  private fun validate(options: ScriptExecutionOptions): String? {
    if (options.script.isBlank()) {
      return "Script cannot be empty"
    }
    if (options.script.length > MAX_SCRIPT_LENGTH) {
      return "Script too large (max ${MAX_SCRIPT_LENGTH / 1024}KB)"
    }
    if (!looksLikeJsonObject(options.paramsJson)) {
      return "paramsJson must be a JSON object"
    }
    if (!looksLikeJsonObject(options.globalsJson)) {
      return "globalsJson must be a JSON object"
    }
    if (options.nativeFuncNames.isNotEmpty() && options.nativeFunctionInvoker == null) {
      return "nativeFunctionInvoker is required when nativeFuncNames is not empty"
    }
    return null
  }

  private fun seedGlobalJson(ctx: QuickJSContext, key: String, json: String) {
    ctx.evaluate("globalThis.$key = JSON.parse(${json.quoteForJsString()});")
  }

  private fun buildWrappedScript(script: String): String {
    return """
      (function() {
        const params = globalThis.__paramsJson || {};
        const globals = globalThis.__globalsJson || {};
        const nativeFuncNames = globalThis.__nativeFuncNames || [];
        Object.keys(globals).forEach(function(key) {
          globalThis[key] = globals[key];
        });
        nativeFuncNames.forEach(function(name) {
          if (typeof globalThis[name] !== 'function') {
            throw new Error('native function not bound: ' + name);
          }
        });
        const result = (function() {
          ${script}
        })();
        return JSON.stringify(result === undefined ? null : result);
      })()
    """.trimIndent()
  }

  private fun record(
    context: ScriptExecutionContext,
    elapsed: Long,
    success: Boolean,
    resultJson: String,
    error: String?,
    forcedState: ExecutionState,
  ) {
    totalCount.incrementAndGet()
    context.elapsedMs = elapsed
    context.errorMessage = error
    context.state = forcedState
    if (success) {
      successCount.incrementAndGet()
      lastError = null
      lastResultPreview = resultJson.take(160)
    } else {
      failureCount.incrementAndGet()
      lastFailedAt.set(context.startedAt + elapsed)
      lastError = error
      lastResultPreview = "null"
    }
    totalTimeMs.addAndGet(elapsed)
    lastElapsedMs.set(elapsed)
    lastExecutedAt.set(context.startedAt)
    lastScriptPreview = context.scriptPreview
  }

  private fun updateMaxConcurrent(currentRunning: Int) {
    while (true) {
      val currentMax = maxConcurrentCount.get()
      if (currentRunning <= currentMax) {
        return
      }
      if (maxConcurrentCount.compareAndSet(currentMax, currentRunning)) {
        return
      }
    }
  }

  private fun dumpExecutionContext(context: ScriptExecutionContext): String {
    return buildString {
      append("executionId=")
      append(context.executionId)
      append(", runtimeId=")
      append(context.runtimeId ?: "null")
      append(", state=")
      append(context.state)
      append(", startedAt=")
      append(context.startedAt)
      append(", elapsedMs=")
      append(context.elapsedMs)
      append(", timeoutMs=")
      append(context.timeoutMs)
      append(", scriptHash=")
      append(context.scriptHash)
      append(", scriptPreview=")
      append(context.scriptPreview)
      append(", compileCacheHit=")
      append(context.compileCacheHit)
      append(", nativeFuncNames=")
      append(context.nativeFuncNames.joinToString(prefix = "[", postfix = "]"))
      append(", nativeCallCount=")
      append(context.nativeCallCount)
      append(", lastNativeCallName=")
      append(context.lastNativeCallName ?: "null")
      append(", lastNativeCallAt=")
      append(context.lastNativeCallAt)
      append(", error=")
      append(context.errorMessage ?: "null")
    }
  }

  private fun looksLikeJsonObject(value: String): Boolean {
    val trimmed = value.trim()
    return trimmed.startsWith("{") && trimmed.endsWith("}")
  }

  private fun argsToJson(args: Array<out Any?>): String {
    return args.joinToString(separator = ",", prefix = "[", postfix = "]") { value ->
      toJsonLiteral(value)
    }
  }

  private fun toJsonArray(values: Array<String>): String {
    return values.joinToString(separator = ",", prefix = "[", postfix = "]") { value ->
      "\"${value.escapeJson()}\""
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

  private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
    return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
  }

  private fun String.quoteForJsString(): String {
    return "\"${escapeJson()}\""
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

  private class ScriptThreadFactory(private val runtimeId: String) : ThreadFactory {
    private val sequence = AtomicLong(0L)

    override fun newThread(runnable: Runnable): Thread {
      return Thread(runnable, "script-engine-$runtimeId-${sequence.incrementAndGet()}").apply {
        isDaemon = true
      }
    }
  }
}
