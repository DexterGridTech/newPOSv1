package com.impos2.posadapter.turbomodules.connector

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.view.KeyEvent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.posadapter.turbomodules.connector.channels.HidStreamChannel
import com.impos2.posadapter.turbomodules.connector.channels.IntentPassiveChannel
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * ConnectorTurboModule：统一对外连接器
 * 支持三种交互模式：
 *   1. Request-Response：call()
 *   2. Stream 订阅推送：subscribe() / unsubscribe()
 *   3. Passive 被动接收：由 IntentPassiveChannel 自动推送 EVENT_PASSIVE
 */
@ReactModule(name = ConnectorTurboModule.NAME)
class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"
        const val EVENT_STREAM  = "connector.stream"
        const val EVENT_PASSIVE = "connector.passive"
        private const val ACTION_USB_PERMISSION = "com.impos2.posadapter.USB_PERMISSION"
    }

    private val registry = ChannelRegistry(reactContext)
    private val passiveChannel = IntentPassiveChannel(reactContext)

    // 活跃的 HID stream 通道，供 onKeyEvent 路由
    private val activeHidChannels = ConcurrentHashMap<String, HidStreamChannel>()

    init {
        passiveChannel.start { event -> sendEvent(EVENT_PASSIVE, event.toWritableMap()) }
    }

    /**
     * 由 MainActivity.dispatchKeyEvent 调用，转发按键事件到所有活跃的 HidStreamChannel。
     * @return true = 事件已被某个 HID 通道消费
     */
    fun onKeyEvent(event: KeyEvent): Boolean {
        if (activeHidChannels.isEmpty()) return false
        var consumed = false
        activeHidChannels.values.forEach { ch ->
            if (ch.onKeyEvent(event)) consumed = true
        }
        return consumed
    }

    /**
     * 请求 USB 权限，授权后执行 onGranted，拒绝后执行 onDenied
     */
    private fun requestUsbPermission(
        device: UsbDevice,
        onGranted: () -> Unit,
        onDenied: () -> Unit
    ) {
        val ctx = reactApplicationContext
        val usbManager = ctx.getSystemService(Context.USB_SERVICE) as UsbManager

        if (usbManager.hasPermission(device)) {
            onGranted()
            return
        }

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                ctx.unregisterReceiver(this)
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                if (granted) onGranted() else onDenied()
            }
        }

        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

        val pi = PendingIntent.getBroadcast(ctx, 0, Intent(ACTION_USB_PERMISSION), flags)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION), Context.RECEIVER_NOT_EXPORTED)
        } else {
            ctx.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION))
        }

        usbManager.requestPermission(device, pi)
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
                    ConnectorCode.UNKNOWN, "call error: ${e.message}"
                )
            )
        }
    }

    // ── 模式二：Subscribe ─────────────────────────────────────────────────────

    @ReactMethod
    fun subscribe(channelJson: String, promise: Promise) {
        try {
            val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))

            when (desc.type) {
                ChannelType.HID -> {
                    val channelId = java.util.UUID.randomUUID().toString()
                    val ch = HidStreamChannel(desc) { event ->
                        sendEvent(EVENT_STREAM, event.copy(channelId = channelId).toWritableMap())
                    }
                    ch.open()
                    activeHidChannels[channelId] = ch
                    promise.resolve(channelId)
                }
                ChannelType.USB -> {
                    val usbManager = reactApplicationContext
                        .getSystemService(Context.USB_SERVICE) as UsbManager
                    val device = usbManager.deviceList[desc.target]
                        ?: return promise.reject("SUBSCRIBE_ERROR", "USB device not found: ${desc.target}")

                    requestUsbPermission(
                        device,
                        onGranted = {
                            try {
                                val channelId = registry.openStreamChannel(desc) { event ->
                                    sendEvent(EVENT_STREAM, event.toWritableMap())
                                }
                                promise.resolve(channelId)
                            } catch (e: Exception) {
                                promise.reject("SUBSCRIBE_ERROR", e.message ?: "subscribe failed")
                            }
                        },
                        onDenied = {
                            promise.reject("USB_PERMISSION_DENIED", "USB permission denied by user: ${desc.target}")
                        }
                    )
                }
                else -> {
                    val channelId = registry.openStreamChannel(desc) { event ->
                        sendEvent(EVENT_STREAM, event.toWritableMap())
                    }
                    promise.resolve(channelId)
                }
            }
        } catch (e: Exception) {
            promise.reject("SUBSCRIBE_ERROR", e.message ?: "subscribe failed")
        }
    }

    @ReactMethod
    fun unsubscribe(channelId: String, promise: Promise) {
        activeHidChannels.remove(channelId)?.close()
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
        activeHidChannels.values.forEach { it.close() }
        activeHidChannels.clear()
        registry.closeAll()
    }
}
