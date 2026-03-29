package com.adapterrn84.turbomodules

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.adapterrn84.turbomodules.connector.*
import com.adapterrn84.turbomodules.connector.channels.*
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

@ReactModule(name = ConnectorTurboModule.NAME)
class ConnectorTurboModule(reactContext: ReactApplicationContext) :
    NativeConnectorTurboModuleSpec(reactContext) {

    companion object {
        const val NAME = "ConnectorTurboModule"
        const val EVENT_STREAM = "connector.stream"
        const val EVENT_PASSIVE = "connector.passive"
        private const val ACTION_USB_PERMISSION = "com.adapterrn84.USB_PERMISSION"
    }

    private val registry = ChannelRegistry(reactContext)
    private val passiveChannel = IntentPassiveChannel(reactContext)
    private val ioExecutor = Executors.newCachedThreadPool()
    private val activeHidChannels = ConcurrentHashMap<String, HidStreamChannel>()

    init {
        passiveChannel.start { event -> sendEvent(EVENT_PASSIVE, event.toMap()) }
    }

    override fun getName() = NAME

    fun onKeyEvent(event: KeyEvent): Boolean {
        if (activeHidChannels.isEmpty()) return false
        var consumed = false
        activeHidChannels.values.forEach { ch ->
            if (ch.onKeyEvent(event)) consumed = true
        }
        return consumed
    }

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

        val handler = Handler(Looper.getMainLooper())
        var timeoutRunnable: Runnable? = null

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                timeoutRunnable?.let { handler.removeCallbacks(it) }
                try {
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    if (granted) onGranted() else onDenied()
                } finally {
                    try {
                        ctx.unregisterReceiver(this)
                    } catch (e: IllegalArgumentException) {
                        // Already unregistered
                    }
                }
            }
        }

        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getBroadcast(ctx, 0, Intent(ACTION_USB_PERMISSION), flags)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION), Context.RECEIVER_NOT_EXPORTED)
        } else {
            ctx.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION))
        }

        timeoutRunnable = Runnable {
            try {
                ctx.unregisterReceiver(receiver)
                onDenied()
            } catch (e: IllegalArgumentException) {
                // Already unregistered
            }
        }
        handler.postDelayed(timeoutRunnable!!, 30000)

        usbManager.requestPermission(device, pi)
    }

    @ReactMethod
    override fun call(channelJson: String, action: String, paramsJson: String, timeout: Double, promise: Promise) {
        try {
            val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))
            val params = JSONObject(paramsJson)
            registry.getRequestResponseChannel(desc).call(action, params, timeout.toLong(), promise)
        } catch (e: Exception) {
            val errorMap = com.facebook.react.bridge.Arguments.createMap().apply {
                putBoolean("success", false)
                putInt("code", ConnectorCode.UNKNOWN)
                putString("message", "call error: ${e.message}")
                putDouble("timestamp", System.currentTimeMillis().toDouble())
                putDouble("duration", 0.0)
                putNull("data")
            }
            promise.resolve(errorMap)
        }
    }

    @ReactMethod
    override fun subscribe(channelJson: String, promise: Promise) {
        try {
            val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))

            when (desc.type) {
                ChannelType.HID -> {
                    val channelId = java.util.UUID.randomUUID().toString()
                    val ch = HidStreamChannel(desc) { event ->
                        sendEvent(EVENT_STREAM, event.copy(channelId = channelId).toMap())
                    }
                    ch.open()
                    activeHidChannels[channelId] = ch
                    promise.resolve(channelId)
                }
                ChannelType.USB -> {
                    val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
                    val device = usbManager.deviceList[desc.target]
                        ?: return promise.reject("SUBSCRIBE_ERROR", "USB device not found: ${desc.target}")

                    requestUsbPermission(
                        device,
                        onGranted = {
                            try {
                                val channelId = registry.openStreamChannel(desc) { event ->
                                    sendEvent(EVENT_STREAM, event.toMap())
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
                        sendEvent(EVENT_STREAM, event.toMap())
                    }
                    promise.resolve(channelId)
                }
            }
        } catch (e: Exception) {
            promise.reject("SUBSCRIBE_ERROR", e.message ?: "subscribe failed")
        }
    }

    @ReactMethod
    override fun unsubscribe(channelId: String, promise: Promise) {
        activeHidChannels.remove(channelId)?.close()
        registry.closeStreamChannel(channelId)
        promise.resolve(null)
    }

    @ReactMethod
    override fun getAvailableTargets(type: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val result = com.facebook.react.bridge.Arguments.createArray()
                when (runCatching { ChannelType.valueOf(type) }.getOrNull()) {
                    ChannelType.USB -> {
                        val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
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
                            bt.bondedDevices?.forEach { device -> result.pushString(device.address) }
                        }
                    }
                    ChannelType.INTENT -> {
                        val pm = reactApplicationContext.packageManager
                        pm.getInstalledPackages(0).forEach { pkg -> result.pushString(pkg.packageName) }
                    }
                    else -> {}
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.resolve(com.facebook.react.bridge.Arguments.createArray())
            }
        }
    }

    @ReactMethod
    override fun isAvailable(channelJson: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val desc = ChannelDescriptor.fromJson(JSONObject(channelJson))
                val available = when (desc.type) {
                    ChannelType.USB -> {
                        val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
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

    private fun sendEvent(eventName: String, params: Map<String, Any?>) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        try {
            val writableMap = com.facebook.react.bridge.Arguments.createMap()
            params.forEach { (key, value) ->
                when (value) {
                    null -> writableMap.putNull(key)
                    is String -> writableMap.putString(key, value)
                    is Int -> writableMap.putInt(key, value)
                    is Double -> writableMap.putDouble(key, value)
                    is Boolean -> writableMap.putBoolean(key, value)
                    is Map<*, *> -> {
                        val nestedMap = com.facebook.react.bridge.Arguments.createMap()
                        @Suppress("UNCHECKED_CAST")
                        (value as? Map<String, Any?>)?.forEach { (k, v) ->
                            when (v) {
                                null -> nestedMap.putNull(k)
                                is String -> nestedMap.putString(k, v)
                                is Int -> nestedMap.putInt(k, v)
                                is Double -> nestedMap.putDouble(k, v)
                                is Boolean -> nestedMap.putBoolean(k, v)
                                else -> nestedMap.putString(k, v.toString())
                            }
                        }
                        writableMap.putMap(key, nestedMap)
                    }
                    else -> writableMap.putString(key, value.toString())
                }
            }
            reactApplicationContext.emitDeviceEvent(eventName, writableMap)
        } catch (_: Exception) {}
    }

    @ReactMethod
    override fun addListener(eventName: String) {}

    @ReactMethod
    override fun removeListeners(count: Double) {}

    override fun invalidate() {
        super.invalidate()
        passiveChannel.stop()
        activeHidChannels.values.forEach { it.close() }
        activeHidChannels.clear()
        registry.closeAll()
        ioExecutor.shutdown()
    }
}
