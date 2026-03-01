package com.impos2.posadapterrn84.turbomodules.device

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.hardware.usb.UsbManager
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.DisplayMetrics
import android.view.Display
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.SecureRandom

class DeviceManager private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var instance: DeviceManager? = null

        fun getInstance(context: Context): DeviceManager =
            instance ?: synchronized(this) {
                instance ?: DeviceManager(context.applicationContext).also { instance = it }
            }

        private const val PREFS_NAME = "device_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val CHARSET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        private const val DEVICE_ID_LENGTH = 10
    }

    @Volatile
    private var lastCpuStat: LongArray = readProcStat()

    // ── DeviceID ──────────────────────────────────────────────────────────────

    fun getOrGenerateDeviceId(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var deviceId = prefs.getString(KEY_DEVICE_ID, null)
        if (deviceId.isNullOrEmpty()) {
            deviceId = generateDeviceId()
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }

    private fun generateDeviceId(): String {
        val random = SecureRandom()
        return (1..DEVICE_ID_LENGTH)
            .map { CHARSET[random.nextInt(CHARSET.length)] }
            .joinToString("")
    }

    // ── DeviceInfo (JSON string) ──────────────────────────────────────────────

    fun getDeviceInfoJson(): String = JSONObject().apply {
        put("id", getOrGenerateDeviceId())
        put("manufacturer", Build.MANUFACTURER)
        put("os", "Android")
        put("osVersion", Build.VERSION.RELEASE)
        put("cpu", getCpuInfoStr())
        put("memory", getMemoryInfoStr())
        put("disk", getDiskInfoStr())
        put("network", getNetworkInfoStr())
        put("displays", getDisplaysJsonArray())
    }.toString()

    private fun getCpuInfoStr(): String {
        val cores = Runtime.getRuntime().availableProcessors()
        return "${Build.HARDWARE}, ${cores}核, ${getCpuFreqStr(cores)}"
    }

    private fun getCpuFreqStr(cores: Int): String {
        val freqKHz = (0 until cores).mapNotNull { cpu ->
            listOf(
                "/sys/devices/system/cpu/cpu$cpu/cpufreq/cpuinfo_max_freq",
                "/sys/devices/system/cpu/cpu$cpu/cpufreq/scaling_max_freq"
            ).firstNotNullOfOrNull { path ->
                try {
                    File(path).readText().trim().toLongOrNull()?.takeIf { it > 1000 }
                } catch (_: Exception) { null }
            }
        }.maxOrNull()
        if (freqKHz != null) return "${freqKHz / 1000} MHz"

        return try {
            var mhz: Double? = null
            var bogomips: Double? = null
            File("/proc/cpuinfo").bufferedReader().forEachLine { line ->
                if (mhz == null && line.startsWith("cpu MHz", ignoreCase = true)) {
                    mhz = line.substringAfter(":").trim().toDoubleOrNull()
                }
                if (bogomips == null && line.startsWith("BogoMIPS", ignoreCase = true)) {
                    bogomips = line.substringAfter(":").trim().toDoubleOrNull()
                }
            }
            when {
                mhz != null -> "%.0f MHz".format(mhz)
                bogomips != null -> "~%.0f MHz (BogoMIPS)".format(bogomips)
                else -> "Unknown"
            }
        } catch (_: Exception) { "Unknown" }
    }

    private fun getMemoryInfoStr(): String {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        return "%.1f GB".format(mi.totalMem / 1024.0 / 1024.0 / 1024.0)
    }

    private fun getDiskInfoStr(): String {
        val stat = StatFs(Environment.getDataDirectory().path)
        val total = stat.blockCountLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        return "%.1f GB".format(total)
    }

    private fun getNetworkInfoStr(): String {
        val types = mutableListOf<String>()
        try {
            NetworkInterface.getNetworkInterfaces()?.asSequence()
                ?.filter { it.isUp && !it.isLoopback }
                ?.forEach { iface ->
                    val name = iface.name.lowercase()
                    when {
                        name.startsWith("wlan") || name.startsWith("wifi") -> types += "WiFi(${iface.name})"
                        name.startsWith("eth") -> types += "Ethernet(${iface.name})"
                        name.startsWith("rmnet") || name.startsWith("ccmni") -> types += "Mobile(${iface.name})"
                        name.startsWith("usb") -> types += "USB(${iface.name})"
                    }
                }
        } catch (_: Exception) {}
        return types.ifEmpty { listOf("None") }.joinToString(", ")
    }

    private fun getDisplaysJsonArray(): JSONArray = JSONArray().also { arr ->
        val dm = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        dm.displays.forEach { display ->
            val metrics = DisplayMetrics().also { display.getRealMetrics(it) }
            arr.put(JSONObject().apply {
                put("id", display.displayId.toString())
                put("displayType", if (display.displayId == Display.DEFAULT_DISPLAY) "primary" else "secondary")
                put("refreshRate", display.refreshRate.toInt())
                put("width", metrics.widthPixels)
                put("height", metrics.heightPixels)
                put("physicalWidth", ((metrics.widthPixels / metrics.xdpi) * 25.4).toInt())
                put("physicalHeight", ((metrics.heightPixels / metrics.ydpi) * 25.4).toInt())
                put("touchSupport", true)
            })
        }
    }

    // ── SystemStatus (JSON string) ────────────────────────────────────────────

    fun getSystemStatusJson(): String = JSONObject().apply {
        put("cpu", getCpuUsageJson())
        put("memory", getMemoryUsageJson())
        put("disk", getDiskUsageJson())
        put("power", buildPowerStatusJson())
        put("usbDevices", getUsbDevicesJson())
        put("bluetoothDevices", getBluetoothDevicesJson())
        put("serialDevices", getSerialDevicesJson())
        put("networks", getNetworksJson())
        put("installedApps", getInstalledAppsJson())
        put("updatedAt", System.currentTimeMillis())
    }.toString()

    private fun readProcStat(): LongArray = try {
        File("/proc/stat").bufferedReader().readLine()
            ?.trim()?.split("\\s+".toRegex())?.drop(1)?.take(7)
            ?.map { it.toLong() }?.toLongArray() ?: LongArray(7)
    } catch (_: Exception) { LongArray(7) }

    private fun getCpuUsageJson(): JSONObject = synchronized(this) {
        val prev = lastCpuStat
        val curr = readProcStat()
        lastCpuStat = curr
        val totalDelta = curr.sum() - prev.sum()
        val idleDelta = curr[3] - prev[3]
        val usage = if (totalDelta > 0) (1.0 - idleDelta.toDouble() / totalDelta) * 100.0 else 0.0
        JSONObject().apply {
            put("app", usage)
            put("cores", Runtime.getRuntime().availableProcessors())
        }
    }

    private fun getMemoryUsageJson(): JSONObject {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val totalMB = mi.totalMem / 1024 / 1024
        val appMB = am.getProcessMemoryInfo(intArrayOf(android.os.Process.myPid()))
            .firstOrNull()?.totalPss?.div(1024) ?: 0
        return JSONObject().apply {
            put("total", totalMB.toDouble())
            put("app", appMB.toDouble())
            put("appPercentage", if (totalMB > 0) appMB * 100.0 / totalMB else 0.0)
        }
    }

    private fun getDiskUsageJson(): JSONObject {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalGB = stat.blockCountLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val availGB = stat.availableBlocksLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val usedGB = totalGB - availGB
        val appMB = getFolderSize(context.filesDir) / 1024.0 / 1024.0
        return JSONObject().apply {
            put("total", totalGB)
            put("used", usedGB)
            put("available", availGB)
            put("overall", if (totalGB > 0) usedGB / totalGB * 100 else 0.0)
            put("app", appMB)
        }
    }

    private fun getFolderSize(f: File): Long =
        f.listFiles()?.sumOf { if (it.isDirectory) getFolderSize(it) else it.length() } ?: 0L

    fun getPowerStatusJson(): String = buildPowerStatusJson().toString()

    private fun buildPowerStatusJson(): JSONObject {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level >= 0 && scale > 0) level * 100 / scale else 0
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val health = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
        return JSONObject().apply {
            put("powerConnected", plugged > 0)
            put("isCharging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            put("batteryLevel", batteryPct)
            put("batteryStatus", when (status) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
                BatteryManager.BATTERY_STATUS_FULL -> "full"
                BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
                else -> "unknown"
            })
            put("batteryHealth", when (health) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
                BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
                BatteryManager.BATTERY_HEALTH_COLD -> "cold"
                else -> "unknown"
            })
        }
    }

    // ── Peripheral Devices ──────────────────────────────────────────────────

    private fun getUsbDevicesJson(): JSONArray = JSONArray().also { arr ->
        try {
            val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
            usbManager?.deviceList?.values?.forEach { d ->
                arr.put(JSONObject().apply {
                    put("name", d.deviceName)
                    put("deviceId", d.deviceId.toString())
                    put("vendorId", d.vendorId.toString())
                    put("productId", d.productId.toString())
                    put("deviceClass", d.deviceClass.toString())
                })
            }
        } catch (_: Exception) {}
    }

    @Suppress("MissingPermission")
    private fun getBluetoothDevicesJson(): JSONArray = JSONArray().also { arr ->
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            ) {
                val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
                bm?.adapter?.bondedDevices?.forEach { d ->
                    val connected = bm.getConnectionState(d, android.bluetooth.BluetoothProfile.GATT) ==
                        android.bluetooth.BluetoothProfile.STATE_CONNECTED
                    arr.put(JSONObject().apply {
                        put("name", d.name ?: "Unknown")
                        put("address", d.address)
                        put("type", when (d.type) {
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE -> "ble"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                            else -> "unknown"
                        })
                        put("connected", connected)
                    })
                }
            }
        } catch (_: Exception) {}
    }

    private fun getSerialDevicesJson(): JSONArray = JSONArray().also { arr ->
        try {
            File("/dev").listFiles { f ->
                f.name.startsWith("ttyS") || f.name.startsWith("ttyUSB") || f.name.startsWith("ttyACM")
            }?.forEach { f ->
                arr.put(JSONObject().apply {
                    put("name", f.name)
                    put("path", f.absolutePath)
                    put("isOpen", false)
                })
            }
        } catch (_: Exception) {}
    }

    private fun getNetworksJson(): JSONArray = JSONArray().also { arr ->
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return@also
            val caps = cm.getNetworkCapabilities(network) ?: return@also
            val linkProps = cm.getLinkProperties(network)

            val type = when {
                caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
                caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
                else -> "unknown"
            }

            val gateway = linkProps?.routes
                ?.firstOrNull { it.isDefaultRoute }
                ?.gateway?.hostAddress ?: ""

            val dnsArr = JSONArray().also { dArr ->
                linkProps?.dnsServers?.forEach { dns ->
                    dns.hostAddress?.let { dArr.put(it) }
                }
            }

            val ipAddress = linkProps?.linkAddresses
                ?.firstOrNull { it.address is Inet4Address }

            val netmask = ipAddress?.let { prefixLengthToNetmask(it.prefixLength) } ?: ""
            val ip = ipAddress?.address?.hostAddress ?: getIpAddress()

            arr.put(JSONObject().apply {
                put("type", type)
                put("name", linkProps?.interfaceName ?: "")
                put("ipAddress", ip)
                put("gateway", gateway)
                put("netmask", netmask)
                put("dns", dnsArr)
                put("connected", true)
            })
        } catch (_: Exception) {}
    }

    private fun prefixLengthToNetmask(prefixLength: Int): String {
        val mask = if (prefixLength == 0) 0 else (-1 shl (32 - prefixLength))
        return "${(mask shr 24) and 0xFF}.${(mask shr 16) and 0xFF}.${(mask shr 8) and 0xFF}.${mask and 0xFF}"
    }

    private fun getIpAddress(): String = try {
        NetworkInterface.getNetworkInterfaces().asSequence()
            .flatMap { it.inetAddresses.asSequence() }
            .firstOrNull { !it.isLoopbackAddress && it is Inet4Address }
            ?.hostAddress ?: ""
    } catch (_: Exception) { "" }

    private fun getInstalledAppsJson(): JSONArray = JSONArray().also { arr ->
        try {
            context.packageManager.getInstalledPackages(0).forEach { pkg ->
                val ai = pkg.applicationInfo ?: return@forEach
                arr.put(JSONObject().apply {
                    put("packageName", pkg.packageName)
                    put("appName", ai.loadLabel(context.packageManager).toString())
                    put("versionName", pkg.versionName ?: "")
                    put("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                        pkg.longVersionCode.toInt() else @Suppress("DEPRECATION") pkg.versionCode)
                    put("installTime", pkg.firstInstallTime)
                    put("updateTime", pkg.lastUpdateTime)
                    put("isSystemApp", (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0)
                })
            }
        } catch (_: Exception) {}
    }
}
