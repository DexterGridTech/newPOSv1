package com.impos2.posadapter.turbomodules

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.hardware.usb.UsbManager
import android.net.Uri
import android.os.IBinder
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Future

class ExternalCallTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ExternalCallTurboModule"
        private const val EVENT_CALL_RESULT = "onExternalCallResult"
        private val EXECUTOR = Executors.newCachedThreadPool()
    }

    // 正在进行的任务 requestId -> Future
    private val pendingCalls = ConcurrentHashMap<String, Future<*>>()

    override fun getName() = NAME

    // ─── call ────────────────────────────────────────────────────────────────

    @ReactMethod
    fun call(requestJson: String, promise: Promise) {
        val req = try { JSONObject(requestJson) } catch (e: Exception) {
            promise.reject("INVALID_PARAMS", "Invalid request JSON"); return
        }
        val requestId = req.optString("requestId").ifEmpty { UUID.randomUUID().toString() }
        val method    = req.optString("method")
        val target    = req.optString("target")
        val action    = req.optString("action")
        val params    = req.optJSONObject("params")
        val timeout   = req.optLong("timeout", 30_000L)
        val startTime = System.currentTimeMillis()

        val future = EXECUTOR.submit {
            val result = try {
                when (method) {
                    "INTENT"    -> callIntent(target, action, params, timeout)
                    "AIDL"      -> callAidl(target, action, params, timeout)
                    "SDK"       -> callSdk(target, action, params)
                    "SERIAL"    -> callSerial(target, action, params, timeout)
                    "USB"       -> callUsb(target, action, params, timeout)
                    "BLUETOOTH" -> callBluetooth(target, action, params, timeout)
                    "NETWORK"   -> callNetwork(target, action, params, timeout)
                    else        -> errorResponse(2002, "Unsupported method: $method")
                }
            } catch (e: InterruptedException) {
                errorResponse(1002, "Cancelled")
            } catch (e: Exception) {
                errorResponse(9999, e.message ?: "Unknown error")
            }
            pendingCalls.remove(requestId)
            val duration = System.currentTimeMillis() - startTime
            result.putDouble("duration", duration.toDouble())
            result.putDouble("timestamp", startTime.toDouble())
            result.putString("requestId", requestId)
            promise.resolve(result)
        }
        pendingCalls[requestId] = future
    }

    // ─── isAvailable ─────────────────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(type: String, target: String, promise: Promise) {
        try {
            val available = when (type) {
                "APP" -> {
                    val pm = reactApplicationContext.packageManager
                    pm.getLaunchIntentForPackage(target) != null
                }
                "HARDWARE" -> {
                    val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
                    usbManager.deviceList.containsKey(target) ||
                        File(target).exists() // serial port path
                }
                "SYSTEM" -> true
                else -> false
            }
            promise.resolve(available)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ─── getAvailableTargets ──────────────────────────────────────────────────

    @ReactMethod
    fun getAvailableTargets(type: String, promise: Promise) {
        try {
            val list = Arguments.createArray()
            when (type) {
                "APP" -> {
                    val pm = reactApplicationContext.packageManager
                    pm.getInstalledPackages(0).forEach { list.pushString(it.packageName) }
                }
                "HARDWARE" -> {
                    val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
                    usbManager.deviceList.keys.forEach { list.pushString(it) }
                    // serial ports
                    File("/dev").listFiles { f -> f.name.startsWith("ttyS") || f.name.startsWith("ttyUSB") }
                        ?.forEach { list.pushString(it.absolutePath) }
                }
                "SYSTEM" -> {
                    list.pushString("android.settings")
                    list.pushString("android.bluetooth")
                    list.pushString("android.wifi")
                }
            }
            promise.resolve(list)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    // ─── cancel ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun cancel(requestId: String, promise: Promise) {
        if (requestId.isEmpty()) {
            pendingCalls.values.forEach { it.cancel(true) }
            pendingCalls.clear()
        } else {
            pendingCalls.remove(requestId)?.cancel(true)
        }
        promise.resolve(null)
    }

    // ─── INTENT ──────────────────────────────────────────────────────────────

    private fun callIntent(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        val ctx = reactApplicationContext
        val intent = Intent(action).apply {
            setPackage(target)
            params?.keys()?.forEach { k -> putExtra(k, params.optString(k)) }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            ctx.startActivity(intent)
            successResponse(null, "Intent sent")
        } catch (e: Exception) {
            errorResponse(2001, "Activity not found: ${e.message}")
        }
    }

    // ─── AIDL ────────────────────────────────────────────────────────────────

    private fun callAidl(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        // target = "com.example.app/.AidlService"
        val parts = target.split("/")
        if (parts.size < 2) return errorResponse(6001, "Invalid AIDL target format: pkg/component")
        val pkg = parts[0]
        val cls = if (parts[1].startsWith(".")) pkg + parts[1] else parts[1]

        val latch = java.util.concurrent.CountDownLatch(1)
        var binderResult: WritableMap = errorResponse(5001, "AIDL bind timeout")
        var conn: ServiceConnection? = null

        conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                try {
                    // Generic AIDL: send params as JSON string via transact
                    val data = android.os.Parcel.obtain()
                    val reply = android.os.Parcel.obtain()
                    data.writeInterfaceToken(pkg)
                    data.writeString(JSONObject().apply {
                        put("action", action)
                        params?.keys()?.forEach { k -> put(k, params[k]) }
                    }.toString())
                    binder!!.transact(1, data, reply, 0)
                    val responseStr = reply.readString()
                    data.recycle(); reply.recycle()
                    binderResult = if (responseStr != null) {
                        val resp = JSONObject(responseStr)
                        successResponse(writableMapFromJson(resp), "OK")
                    } else {
                        successResponse(null, "OK")
                    }
                } catch (e: Exception) {
                    binderResult = errorResponse(5001, "AIDL transact error: ${e.message}")
                } finally {
                    reactApplicationContext.unbindService(conn!!)
                    latch.countDown()
                }
            }
            override fun onServiceDisconnected(name: ComponentName?) { latch.countDown() }
        }

        val intent = Intent().setClassName(pkg, cls)
        val bound = reactApplicationContext.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        if (!bound) return errorResponse(2001, "Cannot bind AIDL service: $target")
        latch.await(timeout, java.util.concurrent.TimeUnit.MILLISECONDS)
        return binderResult
    }

    // ─── SDK ─────────────────────────────────────────────────────────────────

    private fun callSdk(target: String, action: String, params: JSONObject?): WritableMap {
        // SDK dispatch via reflection: target = fully qualified class name
        return try {
            val clazz = Class.forName(target)
            val method = clazz.getMethod(action, String::class.java)
            val result = method.invoke(null, params?.toString() ?: "{}") as? String
            successResponse(if (result != null) writableMapFromJson(JSONObject(result)) else null, "OK")
        } catch (e: ClassNotFoundException) {
            errorResponse(2001, "SDK class not found: $target")
        } catch (e: NoSuchMethodException) {
            errorResponse(2002, "SDK method not found: $action")
        } catch (e: Exception) {
            errorResponse(5001, "SDK call error: ${e.message}")
        }
    }

    // ─── SERIAL ──────────────────────────────────────────────────────────────

    private fun callSerial(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        // target = serial port path e.g. /dev/ttyS1
        // params: { baudRate, data (hex string) }
        val baudRate = params?.optInt("baudRate", 9600) ?: 9600
        val data = params?.optString("data") ?: ""
        return try {
            val port = File(target)
            if (!port.exists()) return errorResponse(4001, "Serial port not found: $target")
            val fos = FileOutputStream(port)
            val fis = FileInputStream(port)
            // Write
            fos.write(hexToBytes(data))
            fos.flush()
            // Read response with timeout
            val buf = ByteArray(1024)
            val deadline = System.currentTimeMillis() + timeout
            var read = 0
            while (System.currentTimeMillis() < deadline) {
                if (fis.available() > 0) { read = fis.read(buf); break }
                Thread.sleep(10)
            }
            fos.close(); fis.close()
            val response = if (read > 0) bytesToHex(buf, read) else ""
            val map = Arguments.createMap().apply { putString("hex", response) }
            successResponse(map, "OK")
        } catch (e: Exception) {
            errorResponse(5001, "Serial error: ${e.message}")
        }
    }

    // ─── USB ─────────────────────────────────────────────────────────────────

    private fun callUsb(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
        val device = usbManager.deviceList[target]
            ?: return errorResponse(4001, "USB device not found: $target")
        if (!usbManager.hasPermission(device)) return errorResponse(3001, "USB permission denied")
        return try {
            val connection = usbManager.openDevice(device)
                ?: return errorResponse(4001, "Cannot open USB device")
            val iface = device.getInterface(0)
            connection.claimInterface(iface, true)
            val outEp = (0 until iface.endpointCount)
                .map { iface.getEndpoint(it) }
                .firstOrNull { it.direction == android.hardware.usb.UsbConstants.USB_DIR_OUT }
                ?: return errorResponse(2002, "No OUT endpoint")
            val inEp = (0 until iface.endpointCount)
                .map { iface.getEndpoint(it) }
                .firstOrNull { it.direction == android.hardware.usb.UsbConstants.USB_DIR_IN }

            val sendData = hexToBytes(params?.optString("data") ?: "")
            connection.bulkTransfer(outEp, sendData, sendData.size, timeout.toInt())

            val response = if (inEp != null) {
                val buf = ByteArray(inEp.maxPacketSize)
                val len = connection.bulkTransfer(inEp, buf, buf.size, timeout.toInt())
                if (len > 0) bytesToHex(buf, len) else ""
            } else ""

            connection.releaseInterface(iface)
            connection.close()
            val map = Arguments.createMap().apply { putString("hex", response) }
            successResponse(map, "OK")
        } catch (e: Exception) {
            errorResponse(5001, "USB error: ${e.message}")
        }
    }

    // ─── BLUETOOTH ───────────────────────────────────────────────────────────

    private fun callBluetooth(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        // target = MAC address
        val btAdapter = BluetoothAdapter.getDefaultAdapter()
            ?: return errorResponse(2002, "Bluetooth not supported")
        if (!btAdapter.isEnabled) return errorResponse(4001, "Bluetooth not enabled")
        var socket: BluetoothSocket? = null
        return try {
            val device = btAdapter.getRemoteDevice(target)
            val uuid = UUID.fromString(params?.optString("uuid") ?: "00001101-0000-1000-8000-00805F9B34FB")
            socket = device.createRfcommSocketToServiceRecord(uuid)
            btAdapter.cancelDiscovery()
            socket.connect()
            val os = socket.outputStream
            val ins = socket.inputStream
            val sendData = hexToBytes(params?.optString("data") ?: "")
            os.write(sendData)
            os.flush()
            val buf = ByteArray(1024)
            val deadline = System.currentTimeMillis() + timeout
            var read = 0
            while (System.currentTimeMillis() < deadline) {
                if (ins.available() > 0) { read = ins.read(buf); break }
                Thread.sleep(10)
            }
            val response = if (read > 0) bytesToHex(buf, read) else ""
            val map = Arguments.createMap().apply { putString("hex", response) }
            successResponse(map, "OK")
        } catch (e: Exception) {
            errorResponse(5001, "Bluetooth error: ${e.message}")
        } finally {
            socket?.close()
        }
    }

    // ─── NETWORK ─────────────────────────────────────────────────────────────

    private fun callNetwork(target: String, action: String, params: JSONObject?, timeout: Long): WritableMap {
        // target = base URL, action = path or full URL
        val urlStr = if (action.startsWith("http")) action
            else (if (target.endsWith("/")) target else "$target/") + action.trimStart('/')
        return try {
            val url = URL(urlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = timeout.toInt()
            conn.readTimeout = timeout.toInt()
            val method = params?.optString("httpMethod", "POST") ?: "POST"
            conn.requestMethod = method
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            if (method != "GET" && params != null) {
                conn.doOutput = true
                conn.outputStream.write(params.toString().toByteArray())
            }
            val code = conn.responseCode
            val body = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val map = Arguments.createMap().apply {
                putInt("httpCode", code)
                putString("body", body)
            }
            if (code in 200..299) successResponse(map, "OK")
            else errorResponse(5001, "HTTP $code")
        } catch (e: Exception) {
            errorResponse(5001, "Network error: ${e.message}")
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun successResponse(data: WritableMap?, message: String): WritableMap =
        Arguments.createMap().apply {
            putInt("code", 0)
            putBoolean("success", true)
            putString("message", message)
            if (data != null) putMap("data", data) else putNull("data")
        }

    private fun errorResponse(code: Int, message: String): WritableMap =
        Arguments.createMap().apply {
            putInt("code", code)
            putBoolean("success", false)
            putString("message", message)
            putNull("data")
        }

    private fun writableMapFromJson(json: JSONObject): WritableMap {
        val map = Arguments.createMap()
        json.keys().forEach { k ->
            when (val v = json[k]) {
                is String  -> map.putString(k, v)
                is Int     -> map.putInt(k, v)
                is Double  -> map.putDouble(k, v)
                is Boolean -> map.putBoolean(k, v)
                else       -> map.putString(k, v.toString())
            }
        }
        return map
    }

    private fun hexToBytes(hex: String): ByteArray {
        val s = hex.replace(" ", "")
        if (s.isEmpty()) return ByteArray(0)
        return ByteArray(s.length / 2) { i -> s.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    private fun bytesToHex(bytes: ByteArray, len: Int): String =
        bytes.take(len).joinToString(" ") { "%02X".format(it) }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        pendingCalls.values.forEach { it.cancel(true) }
        pendingCalls.clear()
    }
}
