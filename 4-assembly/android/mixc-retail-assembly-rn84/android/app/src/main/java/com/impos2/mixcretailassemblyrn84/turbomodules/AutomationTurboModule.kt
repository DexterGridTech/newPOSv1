package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.adapterv2.automation.AutomationHostBridge
import com.impos2.adapterv2.automation.AutomationSession
import com.impos2.adapterv2.automation.AutomationSocketServer
import com.impos2.adapterv2.automation.AutomationSocketServerConfig
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

@ReactModule(name = AutomationTurboModule.NAME)
class AutomationTurboModule(reactContext: ReactApplicationContext) :
  NativeAutomationTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "AutomationTurboModule"
    private const val EVENT_AUTOMATION_MESSAGE = "onAutomationMessage"
  }

  private data class PendingAutomationCall(
    val callId: String,
    val sessionId: String,
    val messageJson: String,
    val latch: CountDownLatch = CountDownLatch(1),
    @Volatile var responseJson: String? = null,
    @Volatile var errorMessage: String? = null,
  )

  private val pendingCalls = ConcurrentHashMap<String, PendingAutomationCall>()
  private val sequence = AtomicLong(0L)
  @Volatile private var server: AutomationSocketServer? = null

  override fun getName(): String = NAME

  override fun startAutomationHost(configJson: String, promise: Promise) {
    runCatching {
      val json = if (configJson.isBlank()) JSONObject() else JSONObject(configJson)
      val port = json.optInt("port", 18_584)
      val startedServer = server ?: AutomationSocketServer(
        AutomationSocketServerConfig(port = port),
        AutomationHostBridge { session, message -> dispatchToJs(session, message) },
      ).also {
        server = it
      }
      val address = startedServer.start()
      JSONObject()
        .put("host", address.host)
        .put("port", address.port)
        .toString()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("AUTOMATION_HOST_ERROR", it.message, it)
    }
  }

  override fun stopAutomationHost(promise: Promise) {
    runCatching {
      server?.stop()
      server = null
      pendingCalls.values.forEach { pending ->
        pending.errorMessage = "Automation host stopped"
        pending.latch.countDown()
      }
      pendingCalls.clear()
    }.onSuccess {
      promise.resolve(null)
    }.onFailure {
      promise.reject("AUTOMATION_HOST_ERROR", it.message, it)
    }
  }

  override fun getAutomationHostStatus(promise: Promise) {
    runCatching {
      val status = server?.getStatus()
      JSONObject()
        .put("running", status?.running ?: false)
        .put("host", status?.host ?: "127.0.0.1")
        .put("port", status?.port ?: 18_584)
        .put("activeSessionCount", status?.activeSessionCount ?: 0)
        .put("acceptedSessionCount", status?.acceptedSessionCount ?: 0L)
        .put("receivedMessageCount", status?.receivedMessageCount ?: 0L)
        .put("failedMessageCount", status?.failedMessageCount ?: 0L)
        .put("startedAt", status?.startedAt ?: 0L)
        .put("stoppedAt", status?.stoppedAt ?: 0L)
        .put("lastError", status?.lastError ?: JSONObject.NULL)
        .toString()
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("AUTOMATION_HOST_ERROR", it.message, it)
    }
  }

  override fun resolveAutomationMessage(callId: String, responseJson: String, promise: Promise) {
    pendingCalls.remove(callId)?.apply {
      this.responseJson = responseJson
      latch.countDown()
    }
    promise.resolve(null)
  }

  override fun rejectAutomationMessage(callId: String, errorMessage: String, promise: Promise) {
    pendingCalls.remove(callId)?.apply {
      this.errorMessage = errorMessage
      latch.countDown()
    }
    promise.resolve(null)
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  override fun invalidate() {
    server?.stop()
    server = null
    pendingCalls.values.forEach { pending ->
      pending.errorMessage = "AutomationTurboModule invalidated"
      pending.latch.countDown()
    }
    pendingCalls.clear()
    super.invalidate()
  }

  private fun dispatchToJs(session: AutomationSession, messageJson: String): String? {
    val callId = "automation-${sequence.incrementAndGet()}-${System.nanoTime()}"
    val pending = PendingAutomationCall(
      callId = callId,
      sessionId = session.sessionId,
      messageJson = messageJson,
    )
    pendingCalls[callId] = pending
    sendAutomationMessageEvent(pending)

    val completed = pending.latch.await(30_000L, TimeUnit.MILLISECONDS)
    pendingCalls.remove(callId)

    if (!completed) {
      return """{"jsonrpc":"2.0","error":{"code":-32001,"message":"automation js dispatcher timeout"},"id":null}"""
    }
    if (pending.errorMessage != null) {
      return """{"jsonrpc":"2.0","error":{"code":-32603,"message":"${escapeJson(pending.errorMessage ?: "automation js dispatcher error")}"},"id":null}"""
    }
    return pending.responseJson
  }

  private fun sendAutomationMessageEvent(pending: PendingAutomationCall) {
    val params = Arguments.createMap().apply {
      putString("callId", pending.callId)
      putString("sessionId", pending.sessionId)
      putString("messageJson", pending.messageJson)
    }
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_AUTOMATION_MESSAGE, params)
  }

  private fun escapeJson(value: String): String =
    value.replace("\\", "\\\\").replace("\"", "\\\"")
}

