package com.impos2.adapter.connector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import com.impos2.adapter.camera.CameraScanActivity
import com.impos2.adapter.camera.CameraScannerManager
import com.impos2.adapter.interfaces.ChannelDescriptor
import com.impos2.adapter.interfaces.ChannelType
import com.impos2.adapter.interfaces.ConnectorCodes
import com.impos2.adapter.interfaces.ConnectorRequest
import com.impos2.adapter.interfaces.ConnectorResponse
import com.impos2.adapter.interfaces.IConnector
import com.impos2.adapter.interfaces.InteractionMode
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class ConnectorManager private constructor(private val context: Context) : IConnector {

  data class ConnectorStreamEvent(
    val channelId: String,
    val type: String,
    val target: String,
    val timestamp: Long,
    val raw: String? = null,
    val data: Map<String, Any?>? = null,
  )

  private data class HidSubscription(
    val channelId: String,
    val channel: ChannelDescriptor,
    val buffer: StringBuilder = StringBuilder(),
    var future: ScheduledFuture<*>? = null,
  )

  companion object {
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

  private val cameraScanner = CameraScannerManager.getInstance()
  private val hidSubscriptions = ConcurrentHashMap<String, HidSubscription>()
  private val scheduler = Executors.newSingleThreadScheduledExecutor()
  private val streamListeners = mutableSetOf<(ConnectorStreamEvent) -> Unit>()
  private val passiveListeners = mutableSetOf<(ConnectorStreamEvent) -> Unit>()
  private var passiveReceiver: BroadcastReceiver? = null

  init {
    startPassiveChannel()
  }

  override fun call(
    activity: ComponentActivity,
    request: ConnectorRequest,
    callback: (ConnectorResponse) -> Unit
  ) {
    val started = System.currentTimeMillis()

    if (request.channel.mode != InteractionMode.REQUEST_RESPONSE) {
      callback(
        response(
          success = false,
          code = ConnectorCodes.NOT_SUPPORTED,
          message = "Only REQUEST_RESPONSE is supported in adapterPure",
          started = started,
        ),
      )
      return
    }

    if (request.channel.type == ChannelType.INTENT && request.channel.target == "camera") {
      if (request.action != CameraScanActivity.ACTION) {
        callback(
          response(
            success = false,
            code = ConnectorCodes.INVALID_PARAM,
            message = "Unsupported camera action: ${request.action}",
            started = started,
          ),
        )
        return
      }

      cameraScanner.startScan(activity, request.params, request.timeoutMs) { result ->
        callback(
          result.copy(
            timestamp = System.currentTimeMillis(),
            duration = System.currentTimeMillis() - started,
          ),
        )
      }
      return
    }

    if (request.channel.type == ChannelType.INTENT && request.channel.target == "system") {
      if (request.action != SystemFilePickerActivity.ACTION_OPEN_DOCUMENT) {
        callback(
          response(
            success = false,
            code = ConnectorCodes.INVALID_PARAM,
            message = "Unsupported system action: ${request.action}",
            started = started,
          ),
        )
        return
      }
      startSystemFilePicker(activity, request, started, callback)
      return
    }

    callback(
      response(
        success = false,
        code = ConnectorCodes.NOT_SUPPORTED,
        message = "Unsupported channel: ${request.channel.type}/${request.channel.target}",
        started = started,
      ),
    )
  }

  override fun isAvailable(channel: ChannelDescriptor): Boolean {
    return when {
      channel.type == ChannelType.INTENT && channel.target == "camera" -> true
      channel.type == ChannelType.INTENT && channel.target == "system" -> true
      channel.type == ChannelType.HID && channel.target == "keyboard" -> true
      channel.type == ChannelType.INTENT && channel.mode == InteractionMode.PASSIVE -> true
      else -> false
    }
  }

  override fun getAvailableTargets(type: ChannelType): List<String> {
    return when (type) {
      ChannelType.INTENT -> listOf("camera", "system", PASSIVE_ACTION)
      ChannelType.HID -> listOf("keyboard")
      else -> emptyList()
    }
  }

  fun subscribe(channel: ChannelDescriptor): String {
    if (channel.type == ChannelType.HID && channel.target == "keyboard" && channel.mode == InteractionMode.STREAM) {
      val channelId = UUID.randomUUID().toString().replace("-", "")
      hidSubscriptions[channelId] = HidSubscription(channelId = channelId, channel = channel)
      return channelId
    }
    throw IllegalStateException("Unsupported subscribe channel: ${channel.type}/${channel.target}/${channel.mode}")
  }

  fun unsubscribe(channelId: String) {
    hidSubscriptions.remove(channelId)?.future?.cancel(false)
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
    if (hidSubscriptions.isEmpty()) {
      return false
    }
    val subscription = hidSubscriptions.values.firstOrNull() ?: return false
    val keyCode = event.keyCode
    if (isSystemKey(keyCode)) {
      return false
    }
    if (event.action != KeyEvent.ACTION_DOWN) {
      return true
    }

    return when (keyCode) {
      KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
        subscription.future?.cancel(false)
        emitBuffered(subscription)
        true
      }
      else -> {
        val char = event.unicodeChar
        if (char == 0) {
          true
        } else {
          subscription.buffer.append(char.toChar())
          subscription.future?.cancel(false)
          subscription.future = scheduler.schedule(
            { emitBuffered(subscription) },
            COMMIT_DELAY_MS,
            TimeUnit.MILLISECONDS,
          )
          true
        }
      }
    }
  }

  fun shutdown() {
    hidSubscriptions.values.forEach { it.future?.cancel(false) }
    hidSubscriptions.clear()
    scheduler.shutdownNow()
    stopPassiveChannel()
    streamListeners.clear()
    passiveListeners.clear()
  }

  private fun startSystemFilePicker(
    activity: ComponentActivity,
    request: ConnectorRequest,
    started: Long,
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
                started = started,
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
                started = started,
              ),
            )
          }
        }
      }
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
    if (passiveReceiver != null) {
      stopPassiveChannel()
    }
    passiveReceiver = object : BroadcastReceiver() {
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
    val filter = IntentFilter().apply {
      addAction(PASSIVE_ACTION)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(passiveReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(passiveReceiver, filter)
    }
  }

  private fun stopPassiveChannel() {
    passiveReceiver?.let {
      runCatching { context.unregisterReceiver(it) }
      passiveReceiver = null
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

  private fun emitBuffered(subscription: HidSubscription) {
    val text = subscription.buffer.toString().trim()
    subscription.buffer.clear()
    if (text.isEmpty()) {
      return
    }
    emitStream(
      ConnectorStreamEvent(
        channelId = subscription.channelId,
        type = subscription.channel.type.name,
        target = subscription.channel.target,
        timestamp = System.currentTimeMillis(),
        raw = text,
        data = mapOf("text" to text),
      ),
    )
  }

  private fun emitStream(event: ConnectorStreamEvent) {
    streamListeners.toList().forEach { it(event) }
  }

  private fun emitPassive(event: ConnectorStreamEvent) {
    passiveListeners.toList().forEach { it(event) }
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
}
