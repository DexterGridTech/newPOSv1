package com.adapterrn84.turbomodules.connector.channels

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbManager
import android.bluetooth.BluetoothAdapter
import android.os.Build
import android.os.IBinder
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private val EXECUTOR = Executors.newCachedThreadPool()

internal fun successMap(data: WritableMap?, message: String): WritableMap =
    Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("code", 0)
        putString("message", message)
        putDouble("timestamp", System.currentTimeMillis().toDouble())
        putDouble("duration", 0.0)
        if (data != null) putMap("data", data) else putNull("data")
    }

internal fun errorMap(code: Int, message: String): WritableMap =
    Arguments.createMap().apply {
        putBoolean("success", false)
        putInt("code", code)
        putString("message", message)
        putDouble("timestamp", System.currentTimeMillis().toDouble())
        putDouble("duration", 0.0)
        putNull("data")
    }

internal fun jsonToWritableMap(json: JSONObject): WritableMap {
    val map = Arguments.createMap()
    json.keys().forEach { k ->
        when (val v = json[k]) {
            is String -> map.putString(k, v)
            is Int -> map.putInt(k, v)
            is Double -> map.putDouble(k, v)
            is Boolean -> map.putBoolean(k, v)
            else -> map.putString(k, v.toString())
        }
    }
    return map
}

internal fun hexToBytes(hex: String): ByteArray {
    val clean = hex.replace(" ", "")
    return ByteArray(clean.length / 2) { clean.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}

internal fun bytesToHex(bytes: ByteArray, len: Int = bytes.size): String =
    bytes.take(len).joinToString("") { "%02X".format(it) }

class IntentChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        val waitResult = params.optBoolean("waitResult", false)
        if (!waitResult) {
            try {
                val intent = Intent(action).apply {
                    params.keys().forEach { k -> if (k != "waitResult") putExtra(k, params.optString(k)) }
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                promise.resolve(successMap(null, "Intent sent"))
            } catch (e: Exception) {
                promise.resolve(errorMap(2001, "Activity not found: ${e.message}"))
            }
        } else {
            EXECUTOR.submit {
                val latch = CountDownLatch(1)
                var result: WritableMap = errorMap(5001, "Intent result timeout")
                val resultAction = "com.adapterrn84.connector.INTENT_RESULT_${UUID.randomUUID()}"

                val receiver = object : BroadcastReceiver() {
                    override fun onReceive(context: Context, intent: Intent) {
                        runCatching {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                context.unregisterReceiver(this)
                            } else {
                                context.unregisterReceiver(this)
                            }
                        }
                        val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
                        val dataStr = intent.getStringExtra("data")
                        val dataMap = if (dataStr != null)
                            runCatching { jsonToWritableMap(JSONObject(dataStr)) }.getOrNull()
                        else null
                        result = if (resultCode == Activity.RESULT_OK)
                            successMap(dataMap, "OK")
                        else {
                            Arguments.createMap().apply {
                                putBoolean("success", false)
                                putInt("code", 4001)
                                putString("message", "Activity result canceled or no data")
                                putDouble("timestamp", System.currentTimeMillis().toDouble())
                                putDouble("duration", 0.0)
                                if (dataMap != null) putMap("data", dataMap) else putNull("data")
                            }
                        }
                        latch.countDown()
                    }
                }

                val filter = IntentFilter(resultAction)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
                } else {
                    context.registerReceiver(receiver, filter)
                }

                try {
                    val bridgeIntent = Intent(context, ResultBridgeActivity::class.java).apply {
                        putExtra(ResultBridgeActivity.EXTRA_TARGET_ACTION, action)
                        putExtra(ResultBridgeActivity.EXTRA_RESULT_BROADCAST, resultAction)
                        params.keys().forEach { k ->
                            if (k != "waitResult") putExtra(k, params.optString(k))
                        }
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(bridgeIntent)
                } catch (e: Exception) {
                    runCatching { context.unregisterReceiver(receiver) }
                    promise.resolve(errorMap(2001, "Cannot start ResultBridgeActivity: ${e.message}"))
                    return@submit
                }

                val completed = latch.await(timeout, TimeUnit.MILLISECONDS)
                if (!completed) {
                    runCatching { context.unregisterReceiver(receiver) }
                }
                promise.resolve(result)
            }
        }
    }
}

class AidlChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        val parts = action.split("/")
        if (parts.size < 2) { promise.resolve(errorMap(6001, "Invalid AIDL target: pkg/component")); return }
        val pkg = parts[0]
        val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]

        EXECUTOR.submit {
            val latch = CountDownLatch(1)
            var result: WritableMap = errorMap(5001, "AIDL bind timeout")
            var timedOut = false

            val connHolder = arrayOfNulls<ServiceConnection>(1)
            connHolder[0] = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                    if (timedOut) { connHolder[0]?.let { runCatching { context.unbindService(it) } }; return }
                    val data = android.os.Parcel.obtain()
                    val reply = android.os.Parcel.obtain()
                    try {
                        data.writeInterfaceToken(pkg)
                        data.writeString(JSONObject().apply {
                            put("action", action)
                            params.keys().forEach { k -> put(k, params[k]) }
                        }.toString())
                        binder?.transact(1, data, reply, 0)
                        val resp = reply.readString()
                        result = if (resp != null) successMap(jsonToWritableMap(JSONObject(resp)), "OK")
                                 else successMap(null, "OK")
                    } catch (e: Exception) {
                        result = errorMap(5001, "AIDL transact error: ${e.message}")
                    } finally {
                        data.recycle()
                        reply.recycle()
                        connHolder[0]?.let { runCatching { context.unbindService(it) } }
                        latch.countDown()
                    }
                }
                override fun onServiceDisconnected(name: ComponentName?) { latch.countDown() }
            }

            val bound = context.bindService(Intent().setClassName(pkg, cls), connHolder[0]!!, Context.BIND_AUTO_CREATE)
            if (!bound) { promise.resolve(errorMap(2001, "Cannot bind AIDL service: $action")); return@submit }

            val completed = latch.await(timeout, TimeUnit.MILLISECONDS)
            if (!completed) {
                timedOut = true
                connHolder[0]?.let { runCatching { context.unbindService(it) } }
            }
            promise.resolve(result)
        }
    }
}

class UsbChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        EXECUTOR.submit {
            val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
            val device = usbManager.deviceList[action]
                ?: run { promise.resolve(errorMap(4001, "USB device not found: $action")); return@submit }
            if (!usbManager.hasPermission(device)) { promise.resolve(errorMap(3001, "USB permission denied")); return@submit }
            val conn = usbManager.openDevice(device)
                ?: run { promise.resolve(errorMap(4001, "Cannot open USB device")); return@submit }
            val iface = device.getInterface(0)
            conn.claimInterface(iface, true)
            try {
                val outEp = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
                    .firstOrNull { it.direction == UsbConstants.USB_DIR_OUT }
                    ?: run { promise.resolve(errorMap(2002, "No OUT endpoint")); return@submit }
                val inEp = (0 until iface.endpointCount).map { iface.getEndpoint(it) }
                    .firstOrNull { it.direction == UsbConstants.USB_DIR_IN }
                val sendData = hexToBytes(params.optString("data", ""))
                conn.bulkTransfer(outEp, sendData, sendData.size, timeout.toInt())
                val hex = if (inEp != null) {
                    val buf = ByteArray(inEp.maxPacketSize)
                    val len = conn.bulkTransfer(inEp, buf, buf.size, timeout.toInt())
                    if (len > 0) bytesToHex(buf, len) else ""
                } else ""
                val map = Arguments.createMap().apply { putString("hex", hex) }
                promise.resolve(successMap(map, "OK"))
            } catch (e: Exception) {
                promise.resolve(errorMap(5001, "USB error: ${e.message}"))
            } finally {
                runCatching { conn.releaseInterface(iface) }
                runCatching { conn.close() }
            }
        }
    }
}

class SerialChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        EXECUTOR.submit {
            val port = File(action)
            if (!port.exists()) { promise.resolve(errorMap(4001, "Serial port not found: $action")); return@submit }
            try {
                FileOutputStream(port).use { fos ->
                    FileInputStream(port).use { fis ->
                        fos.write(hexToBytes(params.optString("data", "")))
                        fos.flush()
                        val buf = ByteArray(1024)
                        val deadline = System.currentTimeMillis() + timeout
                        var read = 0
                        while (System.currentTimeMillis() < deadline) {
                            if (fis.available() > 0) { read = fis.read(buf); break }
                            Thread.sleep(10)
                        }
                        val map = Arguments.createMap().apply {
                            putString("hex", if (read > 0) bytesToHex(buf, read) else "")
                        }
                        promise.resolve(successMap(map, "OK"))
                    }
                }
            } catch (e: Exception) { promise.resolve(errorMap(5001, "Serial error: ${e.message}")) }
        }
    }
}

class BluetoothChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        EXECUTOR.submit {
            val btAdapter = BluetoothAdapter.getDefaultAdapter()
                ?: run { promise.resolve(errorMap(2002, "Bluetooth not supported")); return@submit }
            if (!btAdapter.isEnabled) { promise.resolve(errorMap(4001, "Bluetooth not enabled")); return@submit }
            var socket: android.bluetooth.BluetoothSocket? = null
            try {
                val device = btAdapter.getRemoteDevice(action)
                val uuid = UUID.fromString(params.optString("uuid", "00001101-0000-1000-8000-00805F9B34FB"))
                socket = device.createRfcommSocketToServiceRecord(uuid)
                btAdapter.cancelDiscovery()
                socket.connect()
                socket.outputStream.write(hexToBytes(params.optString("data", "")))
                socket.outputStream.flush()
                val buf = ByteArray(1024)
                val deadline = System.currentTimeMillis() + timeout
                var read = 0
                while (System.currentTimeMillis() < deadline) {
                    if (socket.inputStream.available() > 0) { read = socket.inputStream.read(buf); break }
                    Thread.sleep(10)
                }
                val map = Arguments.createMap().apply {
                    putString("hex", if (read > 0) bytesToHex(buf, read) else "")
                }
                promise.resolve(successMap(map, "OK"))
            } catch (e: Exception) { promise.resolve(errorMap(5001, "Bluetooth error: ${e.message}")) }
            finally { socket?.close() }
        }
    }
}

class NetworkChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        EXECUTOR.submit {
            val conn = try {
                URL(action).openConnection() as HttpURLConnection
            } catch (e: Exception) {
                promise.resolve(errorMap(5001, "Invalid URL: ${e.message}"))
                return@submit
            }
            try {
                conn.connectTimeout = timeout.toInt()
                conn.readTimeout = timeout.toInt()
                val method = params.optString("httpMethod", "POST")
                conn.requestMethod = method
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Accept", "application/json")
                if (method != "GET") {
                    conn.doOutput = true
                    conn.outputStream.write(params.toString().toByteArray())
                }
                val code = conn.responseCode
                val body = (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.readText() ?: ""
                val map = Arguments.createMap().apply { putInt("httpCode", code); putString("body", body) }
                promise.resolve(if (code in 200..299) successMap(map, "OK") else errorMap(5001, "HTTP $code"))
            } catch (e: Exception) {
                promise.resolve(errorMap(5001, "Network error: ${e.message}"))
            } finally {
                runCatching { conn.disconnect() }
            }
        }
    }
}

class SdkChannel(private val context: ReactApplicationContext) : RequestResponseChannel {
    override fun call(action: String, params: JSONObject, timeout: Long, promise: Promise) {
        try {
            val parts = action.split("#")
            if (parts.size < 2) { promise.resolve(errorMap(6001, "Invalid SDK target: className#methodName")); return }
            val clazz = Class.forName(parts[0])
            val method = clazz.getMethod(parts[1], String::class.java)
            val result = method.invoke(null, params.toString()) as? String
            promise.resolve(successMap(if (result != null) jsonToWritableMap(JSONObject(result)) else null, "OK"))
        } catch (e: ClassNotFoundException) { promise.resolve(errorMap(2001, "SDK class not found: $action")) }
        catch (e: NoSuchMethodException) { promise.resolve(errorMap(2002, "SDK method not found: $action")) }
        catch (e: Exception) { promise.resolve(errorMap(5001, "SDK error: ${e.message}")) }
    }
}
