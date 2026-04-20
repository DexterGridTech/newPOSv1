package com.impos2.adapterv2.connector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.util.Log
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import com.impos2.adapterv2.camera.CameraScanActivity
import com.impos2.adapterv2.camera.CameraScannerManager
import com.impos2.adapterv2.interfaces.ChannelDescriptor
import com.impos2.adapterv2.interfaces.ChannelType
import com.impos2.adapterv2.interfaces.ConnectorCodes
import com.impos2.adapterv2.interfaces.ConnectorRequest
import com.impos2.adapterv2.interfaces.ConnectorResponse
import com.impos2.adapterv2.interfaces.IConnector
import com.impos2.adapterv2.interfaces.InteractionMode
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/**
 * Connector 总入口。
 *
 * 这个类负责把 adapterPure 中所有“外部交互通道”收敛到统一入口，包括：
 * - Camera 扫码类 request/response 调用；
 * - 系统 Intent 调用与文件选择；
 * - HID 键盘流式输入订阅；
 * - 被动广播通道；
 *
 * 它本身不直接承载每一种通道的细节，而是通过内部的 [ConnectorHandler] 列表把不同类型的
 * channel 解耦开。这样做的好处是：
 * - 外部只需要面对一个 IConnector；
 * - 新增通道时只要补一个 handler，不需要把所有逻辑堆在 call() 里；
 * - 可以统一治理超时、取消、诊断与 listener 分发。
 *
 * 并发模型：
 * - 对外接口需要线程安全；
 * - 任务生命周期统一由 [tasks] 管理；
 * - 超时调度集中在单线程 scheduler，降低竞态复杂度；
 * - 监听器集合使用 CopyOnWrite 结构，优先保证分发稳定。
 */
class ConnectorManager private constructor(private val context: Context) : IConnector {

  enum class ConnectorState {
    INITIALIZING,
    READY,
    STOPPING,
    STOPPED,
    ERROR,
  }

  data class ConnectorStreamEvent(
    val channelId: String,
    val type: String,
    val target: String,
    val timestamp: Long,
    val raw: String? = null,
    val data: Map<String, Any?>? = null,
  )

  internal data class HidSubscriptionSnapshot(
    val channelId: String,
    val target: String,
    val buffer: StringBuilder = StringBuilder(),
  )

  private data class HidSubscription(
    val channelId: String,
    val channel: ChannelDescriptor,
    val buffer: StringBuilder = StringBuilder(),
    var future: ScheduledFuture<*>? = null,
  )

  private data class ConnectorTask(
    val taskId: String,
    val request: ConnectorRequest,
    val startedAt: Long,
    val completed: AtomicBoolean = AtomicBoolean(false),
    @Volatile var timeoutFuture: ScheduledFuture<*>? = null,
    @Volatile var cancelAction: (() -> Unit)? = null,
  )

  private interface ConnectorHandler {
    fun supports(request: ConnectorRequest): Boolean
    fun isAvailable(channel: ChannelDescriptor): Boolean
    fun availableTargets(type: ChannelType): List<String>
    fun execute(
      activity: ComponentActivity,
      request: ConnectorRequest,
      task: ConnectorTask,
      callback: (ConnectorResponse) -> Unit,
    ): Boolean

    fun subscribe(channel: ChannelDescriptor): String? = null

    fun unsubscribe(channelId: String): Boolean = false

    fun shutdown() = Unit
  }

  companion object {
    private const val TAG = "ConnectorManager"
    private const val PASSIVE_ACTION = "com.impos2.connector.PASSIVE"
    private const val COMMIT_DELAY_MS = 100L

    @Volatile
    private var instance: ConnectorManager? = null

    fun getInstance(context: Context): ConnectorManager {
      return instance ?: synchronized(this) {
        instance ?: ConnectorManager(context.applicationContext).also { instance = it }
      }
    }
  }

  // 当前连接器生命周期状态。所有对外调用都会先经过这个状态门禁。
  private val state = AtomicReference(ConnectorState.INITIALIZING)
  private val cameraScanner = CameraScannerManager.getInstance()
  // 单线程调度器统一负责超时、延迟提交与 HID commit，避免多个定时线程互相打架。
  private val scheduler = Executors.newSingleThreadScheduledExecutor()
  private val streamListeners = CopyOnWriteArraySet<(ConnectorStreamEvent) -> Unit>()
  private val passiveListeners = CopyOnWriteArraySet<(ConnectorStreamEvent) -> Unit>()
  // 当前仍在生命周期内的任务表。任务完成、取消、超时后都会被及时清理。
  private val tasks = ConcurrentHashMap<String, ConnectorTask>()
  private val completedTaskCount = AtomicLong(0)
  private val timeoutTaskCount = AtomicLong(0)
  private val canceledTaskCount = AtomicLong(0)
  private val activeStreamSubscriptionCount = AtomicInteger(0)
  private val lastErrorMessage = AtomicReference<String?>(null)
  private val lastErrorAt = AtomicLong(0)
  private val passiveReceiver = AtomicReference<BroadcastReceiver?>(null)
  private val handlers: List<ConnectorHandler>

  init {
    handlers = listOf(
      CameraIntentHandler(),
      SystemIntentHandler(),
      HidKeyboardHandler(),
      PassiveIntentHandler(),
    )
    startPassiveChannel()
    state.set(ConnectorState.READY)
    logInfo("connector initialized")
  }

  override fun call(
    activity: ComponentActivity,
    request: ConnectorRequest,
    callback: (ConnectorResponse) -> Unit
  ) {
    val currentState = state.get()
    if (currentState != ConnectorState.READY) {
      callback(
        response(
          success = false,
          code = ConnectorCodes.UNKNOWN,
          message = "Connector is not ready: $currentState",
          started = System.currentTimeMillis(),
        ),
      )
      return
    }

    if (request.channel.mode != InteractionMode.REQUEST_RESPONSE) {
      callback(
        response(
          success = false,
          code = ConnectorCodes.NOT_SUPPORTED,
          message = "Only REQUEST_RESPONSE is supported in adapterPure",
          started = System.currentTimeMillis(),
        ),
      )
      return
    }

    val started = System.currentTimeMillis()
    val task = ConnectorTask(
      taskId = UUID.randomUUID().toString().replace("-", ""),
      request = request,
      startedAt = started,
    )
    tasks[task.taskId] = task
    scheduleTimeout(task, callback)
    logInfo(
      "call start taskId=${task.taskId} channel=${request.channel.type}/${request.channel.target} action=${request.action} timeout=${request.timeoutMs}",
    )

    val taskCallback: (ConnectorResponse) -> Unit = { rawResponse ->
      finishTask(task, rawResponse, callback)
    }

    try {
      val handled = handlers.any { it.execute(activity, request, task, taskCallback) }
      if (!handled) {
        finishTask(
          task,
          response(
            success = false,
            code = ConnectorCodes.NOT_SUPPORTED,
            message = "Unsupported channel: ${request.channel.type}/${request.channel.target}",
            started = started,
          ),
          callback,
        )
      }
    } catch (error: Throwable) {
      logError("call failed taskId=${task.taskId}", error)
      finishTask(
        task,
        response(
          success = false,
          code = ConnectorCodes.UNKNOWN,
          message = error.message ?: "CONNECTOR_CALL_ERROR",
          started = started,
        ),
        callback,
      )
    }
  }

  override fun isAvailable(channel: ChannelDescriptor): Boolean {
    if (state.get() != ConnectorState.READY) {
      return false
    }
    return handlers.any { it.isAvailable(channel) }
  }

  override fun getAvailableTargets(type: ChannelType): List<String> {
    val result = linkedSetOf<String>()
    handlers.flatMapTo(result) { it.availableTargets(type) }
    return result.toList()
  }

  fun subscribe(channel: ChannelDescriptor): String {
    ensureReady()
    handlers.forEach { handler ->
      val channelId = handler.subscribe(channel)
      if (channelId != null) {
        logInfo("subscribe channelId=$channelId type=${channel.type} target=${channel.target} mode=${channel.mode}")
        return channelId
      }
    }
    throw IllegalStateException("Unsupported subscribe channel: ${channel.type}/${channel.target}/${channel.mode}")
  }

  fun unsubscribe(channelId: String) {
    val removed = handlers.any { it.unsubscribe(channelId) }
    logInfo("unsubscribe channelId=$channelId removed=$removed")
  }

  fun onStream(listener: (ConnectorStreamEvent) -> Unit): () -> Unit {
    streamListeners.add(listener)
    return { streamListeners.remove(listener) }
  }

  fun onPassive(listener: (ConnectorStreamEvent) -> Unit): () -> Unit {
    passiveListeners.add(listener)
    return { passiveListeners.remove(listener) }
  }

  fun handleKeyEvent(event: KeyEvent): Boolean {
    if (state.get() != ConnectorState.READY) {
      return false
    }
    val handler = handlers.filterIsInstance<HidKeyboardHandler>().firstOrNull() ?: return false
    return handler.handleKeyEvent(event)
  }

  fun shutdown() {
    if (!state.compareAndSet(ConnectorState.READY, ConnectorState.STOPPING)) {
      return
    }
    logInfo("shutdown start")
    tasks.values.forEach { task ->
      task.cancelAction?.invoke()
      task.timeoutFuture?.cancel(false)
    }
    tasks.clear()
    handlers.forEach { it.shutdown() }
    scheduler.shutdownNow()
    streamListeners.clear()
    passiveListeners.clear()
    state.set(ConnectorState.STOPPED)
    logInfo("shutdown end")
  }

  fun dumpState(): Map<String, Any?> {
    return mapOf(
      "state" to state.get().name,
      "streamListenerCount" to streamListeners.size,
      "passiveListenerCount" to passiveListeners.size,
      "activeTaskCount" to tasks.size,
      "completedTaskCount" to completedTaskCount.get(),
      "timeoutTaskCount" to timeoutTaskCount.get(),
      "canceledTaskCount" to canceledTaskCount.get(),
      "activeStreamSubscriptionCount" to activeStreamSubscriptionCount.get(),
      "passiveReceiverRegistered" to (passiveReceiver.get() != null),
      "lastErrorMessage" to lastErrorMessage.get(),
      "lastErrorAt" to lastErrorAt.get().takeIf { it > 0L },
    )
  }

  private fun ensureReady() {
    check(state.get() == ConnectorState.READY) { "Connector is not ready: ${state.get()}" }
  }

  private fun scheduleTimeout(
    task: ConnectorTask,
    callback: (ConnectorResponse) -> Unit,
  ) {
    val timeoutMs = task.request.timeoutMs.coerceAtLeast(1L)
    task.timeoutFuture = scheduler.schedule({
      if (!task.completed.compareAndSet(false, true)) {
        return@schedule
      }
      tasks.remove(task.taskId)
      task.cancelAction?.invoke()
      timeoutTaskCount.incrementAndGet()
      val response = ConnectorResponse(
        success = false,
        code = ConnectorCodes.TIMEOUT,
        message = "Connector call timeout after ${timeoutMs}ms",
        timestamp = System.currentTimeMillis(),
        duration = System.currentTimeMillis() - task.startedAt,
      )
      logWarn("call timeout taskId=${task.taskId} duration=${response.duration}")
      callback(response)
    }, timeoutMs, TimeUnit.MILLISECONDS)
  }

  private fun finishTask(
    task: ConnectorTask,
    rawResponse: ConnectorResponse,
    callback: (ConnectorResponse) -> Unit,
  ) {
    if (!task.completed.compareAndSet(false, true)) {
      logWarn("duplicate or late callback ignored taskId=${task.taskId}")
      return
    }
    tasks.remove(task.taskId)
    task.timeoutFuture?.cancel(false)
    completedTaskCount.incrementAndGet()
    val response = rawResponse.copy(
      timestamp = System.currentTimeMillis(),
      duration = System.currentTimeMillis() - task.startedAt,
    )
    logInfo(
      "call end taskId=${task.taskId} success=${response.success} code=${response.code} duration=${response.duration}",
    )
    callback(response)
  }

  private fun startSystemFilePicker(
    activity: ComponentActivity,
    request: ConnectorRequest,
    task: ConnectorTask,
    callback: (ConnectorResponse) -> Unit,
  ) {
    val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
      override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
        when (resultCode) {
          ConnectorResultCodes.SUCCESS -> {
            val json = resultData?.getString("data") ?: "{}"
            val data = parseJsonMap(json)
            callback(
              response(
                success = true,
                code = ConnectorCodes.SUCCESS,
                message = "OK",
                started = task.startedAt,
                data = data,
              ),
            )
          }
          else -> {
            callback(
              response(
                success = false,
                code = ConnectorCodes.CANCELED,
                message = resultData?.getString("error") ?: "CANCELED",
                started = task.startedAt,
              ),
            )
          }
        }
      }
    }

    task.cancelAction = {
      canceledTaskCount.incrementAndGet()
      finishTask(
        task,
        createCanceledConnectorResponse(task.startedAt),
        callback,
      )
    }

    val intent = Intent(activity, SystemFilePickerActivity::class.java).apply {
      putExtra(SystemFilePickerActivity.EXTRA_TARGET_ACTION, request.action)
      putExtra(SystemFilePickerActivity.EXTRA_RESULT_RECEIVER, receiver)
      request.params["type"]?.toString()?.let { putExtra("type", it) }
      request.params["category"]?.toString()?.let { putExtra("category", it) }
    }
    activity.startActivity(intent)
  }

  private fun startPassiveChannel() {
    if (passiveReceiver.get() != null) {
      stopPassiveChannel()
    }
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val data = mutableMapOf<String, Any?>()
        intent.extras?.keySet()?.forEach { key ->
          data[key] = intent.extras?.get(key)?.toString()
        }
        emitPassive(
          ConnectorStreamEvent(
            channelId = "passive.intent",
            type = ChannelType.INTENT.name,
            target = action,
            timestamp = System.currentTimeMillis(),
            data = data,
          ),
        )
      }
    }
    passiveReceiver.set(receiver)
    val filter = IntentFilter().apply {
      addAction(PASSIVE_ACTION)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }
  }

  private fun stopPassiveChannel() {
    passiveReceiver.getAndSet(null)?.let {
      runCatching { context.unregisterReceiver(it) }
        .onFailure { logWarn("failed to unregister passiveReceiver: ${it.message}") }
    }
  }

  private fun isSystemKey(keyCode: Int): Boolean {
    return keyCode in setOf(
      KeyEvent.KEYCODE_BACK,
      KeyEvent.KEYCODE_HOME,
      KeyEvent.KEYCODE_VOLUME_UP,
      KeyEvent.KEYCODE_VOLUME_DOWN,
      KeyEvent.KEYCODE_VOLUME_MUTE,
      KeyEvent.KEYCODE_POWER,
      KeyEvent.KEYCODE_MENU,
      KeyEvent.KEYCODE_APP_SWITCH,
      KeyEvent.KEYCODE_CAMERA,
    )
  }

  private fun emitStream(event: ConnectorStreamEvent) {
    streamListeners.forEach { listener ->
      runCatching { listener(event) }
        .onFailure { logWarn("stream listener failed: ${it.message}") }
    }
  }

  private fun emitPassive(event: ConnectorStreamEvent) {
    passiveListeners.forEach { listener ->
      runCatching { listener(event) }
        .onFailure { logWarn("passive listener failed: ${it.message}") }
    }
  }

  private fun parseJsonMap(jsonText: String): Map<String, Any?> {
    val json = JSONObject(jsonText)
    val result = mutableMapOf<String, Any?>()
    json.keys().forEach { key ->
      result[key] = json.opt(key)
    }
    return result
  }

  private fun response(
    success: Boolean,
    code: Int,
    message: String,
    started: Long,
    data: Map<String, Any?>? = null,
  ): ConnectorResponse {
    return ConnectorResponse(
      success = success,
      code = code,
      message = message,
      data = data,
      timestamp = System.currentTimeMillis(),
      duration = System.currentTimeMillis() - started,
    )
  }

  private fun logInfo(message: String) {
    Log.i(TAG, message)
  }

  private fun logWarn(message: String) {
    Log.w(TAG, message)
    lastErrorMessage.set(message)
    lastErrorAt.set(System.currentTimeMillis())
  }

  private fun logError(message: String, error: Throwable) {
    Log.e(TAG, message, error)
    lastErrorMessage.set("$message: ${error.message}")
    lastErrorAt.set(System.currentTimeMillis())
  }

  private inner class CameraIntentHandler : ConnectorHandler {
    override fun supports(request: ConnectorRequest): Boolean {
      return request.channel.type == ChannelType.INTENT && request.channel.target == "camera"
    }

    override fun isAvailable(channel: ChannelDescriptor): Boolean {
      return channel.type == ChannelType.INTENT && channel.target == "camera"
    }

    override fun availableTargets(type: ChannelType): List<String> {
      return if (type == ChannelType.INTENT) listOf("camera") else emptyList()
    }

    override fun execute(
      activity: ComponentActivity,
      request: ConnectorRequest,
      task: ConnectorTask,
      callback: (ConnectorResponse) -> Unit,
    ): Boolean {
      if (!supports(request)) {
        return false
      }
      if (request.action != CameraScanActivity.ACTION) {
        callback(
          response(
            success = false,
            code = ConnectorCodes.INVALID_PARAM,
            message = "Unsupported camera action: ${request.action}",
            started = task.startedAt,
          ),
        )
        return true
      }
      task.cancelAction = {
        canceledTaskCount.incrementAndGet()
      }
      cameraScanner.startScan(activity, request.params, request.timeoutMs) { result ->
        callback(result)
      }
      return true
    }
  }

  private inner class SystemIntentHandler : ConnectorHandler {
    override fun supports(request: ConnectorRequest): Boolean {
      return request.channel.type == ChannelType.INTENT && request.channel.target == "system"
    }

    override fun isAvailable(channel: ChannelDescriptor): Boolean {
      return channel.type == ChannelType.INTENT && channel.target == "system"
    }

    override fun availableTargets(type: ChannelType): List<String> {
      return if (type == ChannelType.INTENT) listOf("system") else emptyList()
    }

    override fun execute(
      activity: ComponentActivity,
      request: ConnectorRequest,
      task: ConnectorTask,
      callback: (ConnectorResponse) -> Unit,
    ): Boolean {
      if (!supports(request)) {
        return false
      }
      if (request.action != SystemFilePickerActivity.ACTION_OPEN_DOCUMENT) {
        callback(
          response(
            success = false,
            code = ConnectorCodes.INVALID_PARAM,
            message = "Unsupported system action: ${request.action}",
            started = task.startedAt,
          ),
        )
        return true
      }
      startSystemFilePicker(activity, request, task, callback)
      return true
    }
  }

  private inner class HidKeyboardHandler : ConnectorHandler {
    private val subscriptions = ConcurrentHashMap<String, HidSubscription>()

    override fun supports(request: ConnectorRequest): Boolean = false

    override fun isAvailable(channel: ChannelDescriptor): Boolean {
      return channel.type == ChannelType.HID && channel.target == "keyboard"
    }

    override fun availableTargets(type: ChannelType): List<String> {
      return if (type == ChannelType.HID) listOf("keyboard") else emptyList()
    }

    override fun execute(
      activity: ComponentActivity,
      request: ConnectorRequest,
      task: ConnectorTask,
      callback: (ConnectorResponse) -> Unit,
    ): Boolean = false

    override fun subscribe(channel: ChannelDescriptor): String? {
      if (channel.type == ChannelType.HID && channel.target == "keyboard" && channel.mode == InteractionMode.STREAM) {
        val channelId = UUID.randomUUID().toString().replace("-", "")
        subscriptions[channelId] = HidSubscription(channelId = channelId, channel = channel)
        activeStreamSubscriptionCount.incrementAndGet()
        return channelId
      }
      return null
    }

    override fun unsubscribe(channelId: String): Boolean {
      val removed = subscriptions.remove(channelId) ?: return false
      removed.future?.cancel(false)
      activeStreamSubscriptionCount.decrementAndGet()
      return true
    }

    override fun shutdown() {
      subscriptions.values.forEach { it.future?.cancel(false) }
      activeStreamSubscriptionCount.addAndGet(-subscriptions.size)
      subscriptions.clear()
    }

    fun handleKeyEvent(event: KeyEvent): Boolean {
      if (subscriptions.isEmpty()) {
        return false
      }
      val keyCode = event.keyCode
      if (isSystemKey(keyCode)) {
        return false
      }
      if (event.action != KeyEvent.ACTION_DOWN) {
        return true
      }

      val snapshot = subscriptions.values.toList()
      if (snapshot.isEmpty()) {
        return false
      }

      return when (keyCode) {
        KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
          snapshot.forEach { subscription ->
            subscription.future?.cancel(false)
            emitBuffered(subscription)
          }
          true
        }
        else -> {
          val char = event.unicodeChar
          if (char == 0) {
            true
          } else {
            appendBufferedCharForSubscriptions(snapshot.map { it.toSnapshot() }, char.toChar())
            snapshot.forEach { subscription ->
              subscription.future?.cancel(false)
              subscription.future = scheduler.schedule(
                { emitBuffered(subscription) },
                COMMIT_DELAY_MS,
                TimeUnit.MILLISECONDS,
              )
            }
            true
          }
        }
      }
    }

    private fun emitBuffered(subscription: HidSubscription) {
      buildHidBufferedEvent(subscription.toSnapshot())?.let(::emitStream)
    }

    private fun HidSubscription.toSnapshot(): HidSubscriptionSnapshot {
      return HidSubscriptionSnapshot(
        channelId = channelId,
        target = channel.target,
        buffer = buffer,
      )
    }
  }

  private inner class PassiveIntentHandler : ConnectorHandler {
    override fun supports(request: ConnectorRequest): Boolean = false

    override fun isAvailable(channel: ChannelDescriptor): Boolean {
      return channel.type == ChannelType.INTENT && channel.mode == InteractionMode.PASSIVE
    }

    override fun availableTargets(type: ChannelType): List<String> {
      return if (type == ChannelType.INTENT) listOf(PASSIVE_ACTION) else emptyList()
    }

    override fun execute(
      activity: ComponentActivity,
      request: ConnectorRequest,
      task: ConnectorTask,
      callback: (ConnectorResponse) -> Unit,
    ): Boolean = false
  }
}

internal fun appendBufferedCharForSubscriptions(
  subscriptions: List<ConnectorManager.HidSubscriptionSnapshot>,
  char: Char,
) {
  subscriptions.forEach { it.buffer.append(char) }
}

internal fun flushBufferedSubscriptions(
  subscriptions: List<ConnectorManager.HidSubscriptionSnapshot>,
  timestamp: Long = System.currentTimeMillis(),
): List<ConnectorManager.ConnectorStreamEvent> {
  return subscriptions.mapNotNull { buildHidBufferedEvent(it, timestamp) }
}

internal fun createCanceledConnectorResponse(
  startedAt: Long,
  timestamp: Long = System.currentTimeMillis(),
): ConnectorResponse {
  return ConnectorResponse(
    success = false,
    code = ConnectorCodes.CANCELED,
    message = "CANCELED",
    timestamp = timestamp,
    duration = timestamp - startedAt,
  )
}

private fun buildHidBufferedEvent(
  subscription: ConnectorManager.HidSubscriptionSnapshot,
  timestamp: Long = System.currentTimeMillis(),
): ConnectorManager.ConnectorStreamEvent? {
  val text = subscription.buffer.toString().trim()
  subscription.buffer.clear()
  if (text.isEmpty()) {
    return null
  }
  return ConnectorManager.ConnectorStreamEvent(
    channelId = subscription.channelId,
    type = ChannelType.HID.name,
    target = subscription.target,
    timestamp = timestamp,
    raw = text,
    data = mapOf("text" to text),
  )
}
