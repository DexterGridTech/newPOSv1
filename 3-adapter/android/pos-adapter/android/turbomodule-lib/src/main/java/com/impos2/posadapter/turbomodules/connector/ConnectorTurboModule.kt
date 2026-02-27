package com.impos2.posadapter.turbomodules.connector

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.posadapter.turbomodules.connector.channels.IntentPassiveChannel
import org.json.JSONObject

/**
 * ConnectorTurboModule：统一对外连接器
 * 支持三种交互模式：
 *   1. Request-Response：call()
 *   2. Stream 订阅推送：subscribe() / unsubscribe()
 *   3. Passive 被动接收：由 IntentPassiveChannel 自动推送 EVENT_PASSIVE
 */
class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"
        /** Stream 模式推送事件名，TS 层通过 NativeEventEmitter 监听 */
        const val EVENT_STREAM  = "connector.stream"
        /** Passive 模式推送事件名，TS 层通过 NativeEventEmitter 监听 */
        const val EVENT_PASSIVE = "connector.passive"
    }

    private val registry = ChannelRegistry(reactContext)
    private val passiveChannel = IntentPassiveChannel(reactContext)

    init {
        // 模块初始化时自动启动被动接收通道
        passiveChannel.start { event -> sendEvent(EVENT_PASSIVE, event.toWritableMap()) }
    }

    override fun getName() = NAME

    // ── 模式一：Request-Response ──────────────────────────────────────────────

    @ReactMethod
    fun call(channelJson: String, action: String, paramsJson: String,
             timeout: Double, promise: Promise) {
        try {
            val desc   = ChannelDescriptor.fromJson(JSONObject(channelJson))
            val params = JSONObject(paramsJson)
            registry.getRequestResponseChannel(desc)
                .call(action, params, timeout.toLong(), promise)
        } catch (e: Exception) {
            promise.resolve(
                com.impos2.posadapter.turbomodules.connector.channels.errorMap(
                    9999, "call error: ${e.message}"
                )
            )
        }
    }

    // ── 模式二：Subscribe ─────────────────────────────────────────────────────

    @ReactMethod
    fun subscribe(channelJson: String, promise: Promise) {
        try {
            val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))
            val channelId = registry.openStreamChannel(desc) { event ->
                sendEvent(EVENT_STREAM, event.toWritableMap())
            }
            promise.resolve(channelId)
        } catch (e: Exception) {
            promise.reject("SUBSCRIBE_ERROR", e.message ?: "subscribe failed")
        }
    }

    @ReactMethod
    fun unsubscribe(channelId: String, promise: Promise) {
        registry.closeStreamChannel(channelId)
        promise.resolve(null)
    }

    // ── 工具方法 ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun getAvailableTargets(type: String, promise: Promise) {
        android.os.AsyncTask.THREAD_POOL_EXECUTOR.execute {
            try {
                val result = com.facebook.react.bridge.Arguments.createArray()
                when (runCatching { ChannelType.valueOf(type) }.getOrNull()) {
                    ChannelType.USB -> {
                        val usbManager = reactApplicationContext
                            .getSystemService(android.content.Context.USB_SERVICE)
                            as android.hardware.usb.UsbManager
                        usbManager.deviceList.keys.forEach { result.pushString(it) }
                    }
                    ChannelType.SERIAL -> {
                        listOf("/dev/ttyS0", "/dev/ttyS1", "/dev/ttyUSB0", "/dev/ttyUSB1").forEach {
                            if (java.io.File(it).exists()) result.pushString(it)
                        }
                    }
                    ChannelType.BLUETOOTH -> {
                        val bt = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
                        if (bt != null && bt.isEnabled) {
                            bt.bondedDevices?.forEach { device ->
                                result.pushString(device.address)
                            }
                        }
                    }
                    ChannelType.INTENT -> {
                        val pm = reactApplicationContext.packageManager
                        pm.getInstalledPackages(0).forEach { pkg ->
                            result.pushString(pkg.packageName)
                        }
                    }
                    else -> { /* AIDL / NETWORK / SDK 无法枚举，返回空 */ }
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.resolve(com.facebook.react.bridge.Arguments.createArray())
            }
        }
    }

    @ReactMethod
    fun isAvailable(channelJson: String, promise: Promise) {
        // 部分操作（USB deviceList、BT getDefaultAdapter）在某些设备上是阻塞调用，移到后台线程
        android.os.AsyncTask.THREAD_POOL_EXECUTOR.execute {
            try {
                val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))
                val available = when (desc.type) {
                    ChannelType.USB -> {
                        val usbManager = reactApplicationContext
                            .getSystemService(android.content.Context.USB_SERVICE)
                            as android.hardware.usb.UsbManager
                        usbManager.deviceList.containsKey(desc.target)
                    }
                    ChannelType.SERIAL -> java.io.File(desc.target).exists()
                    ChannelType.BLUETOOTH -> {
                        val bt = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
                        bt != null && bt.isEnabled
                    }
                    ChannelType.INTENT -> {
                        val pm = reactApplicationContext.packageManager
                        pm.getLaunchIntentForPackage(desc.target) != null
                    }
                    else -> true
                }
                promise.resolve(available)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        // JS bundle 未加载完成时 getJSModule 会抛异常，需要防御
        if (!reactApplicationContext.hasActiveReactInstance()) return
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (_: Exception) {
            // JS 层尚未就绪，事件丢弃（被动事件不做缓存，避免内存无限增长）
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        passiveChannel.stop()
        registry.closeAll()
    }
}
