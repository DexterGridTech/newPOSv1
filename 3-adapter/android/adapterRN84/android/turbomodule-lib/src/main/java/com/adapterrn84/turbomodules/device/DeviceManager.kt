package com.adapterrn84.turbomodules.device

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.security.MessageDigest

class DeviceManager private constructor(private val context: Context) {

    companion object {
        @Volatile private var instance: DeviceManager? = null
        fun getInstance(context: Context): DeviceManager =
            instance ?: synchronized(this) {
                instance ?: DeviceManager(context.applicationContext).also { instance = it }
            }

        private fun readProcStat(): LongArray = try {
            val line = java.io.File("/proc/stat").bufferedReader().readLine() ?: return LongArray(7)
            line.trim().split("\\s+".toRegex()).drop(1).take(7).map { it.toLong() }.toLongArray()
        } catch (_: Exception) { LongArray(7) }

        private const val PREFS_NAME = "device_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val CHARSET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        private const val DEVICE_ID_LENGTH = 10
    }

    @Volatile private var lastCpuStat: LongArray = readProcStat()

    // ─── DeviceID ─────────────────────────────────────────────────────────────

    fun getOrGenerateDeviceId(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotEmpty() }
            ?: generateDeviceId().also { prefs.edit().putString(KEY_DEVICE_ID, it).apply() }
    }

    private fun generateDeviceId(): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown_device"
        return try {
            val hash = MessageDigest.getInstance("SHA-256").digest(androidId.toByteArray())
            val hashValue = hash.fold(0L) { acc, b -> (acc * 256 + (b.toInt() and 0xFF)) % Long.MAX_VALUE }
            (0 until DEVICE_ID_LENGTH).map { i ->
                val pos = ((hashValue shr (i * 5)) % CHARSET.length).toInt().let { if (it < 0) it + CHARSET.length else it }
                CHARSET[pos]
            }.joinToString("")
        } catch (_: Exception) {
            androidId.take(DEVICE_ID_LENGTH).map { c ->
                when { c.isDigit() -> c; c.isLetter() -> c.uppercaseChar(); else -> CHARSET[c.code % CHARSET.length] }
            }.joinToString("").padEnd(DEVICE_ID_LENGTH, '0')
        }
    }

    // ─── DeviceInfo ───────────────────────────────────────────────────────────

    fun getDeviceInfo(): WritableMap = Arguments.createMap().apply {
        putString("id", getOrGenerateDeviceId())
        putString("manufacturer", Build.MANUFACTURER)
        putString("os", "Android")
        putString("osVersion", Build.VERSION.RELEASE)
        putString("cpu", getCpuInfo())
        putString("memory", getMemoryInfoStr())
        putString("disk", getDiskInfoStr())
        putString("network", getNetworkInfoStr())
        putArray("displays", getDisplayArray())
    }

    private fun getCpuInfo(): String {
        val cores = Runtime.getRuntime().availableProcessors()
        return "${Build.HARDWARE}, ${cores}核, ${getCpuFreqStr(cores)}"
    }

    private fun getCpuFreqStr(cores: Int): String {
        val freqKHz = (0 until cores).mapNotNull { i ->
            listOf(
                "/sys/devices/system/cpu/cpu$i/cpufreq/cpuinfo_max_freq",
                "/sys/devices/system/cpu/cpu$i/cpufreq/scaling_max_freq"
            ).firstNotNullOfOrNull { path ->
                java.io.File(path).takeIf { it.exists() }?.readText()?.trim()?.toLongOrNull()?.takeIf { it > 1000 }
            }
        }.maxOrNull()
        if (freqKHz != null) return "${freqKHz / 1000} MHz"
        return try {
            var mhz: Double? = null
            java.io.File("/proc/cpuinfo").bufferedReader().forEachLine { line ->
                if (line.startsWith("cpu MHz", ignoreCase = true))
                    mhz = mhz ?: line.substringAfter(":").trim().toDoubleOrNull()
            }
            if (mhz != null) "%.0f MHz".format(mhz) else "Unknown"
        } catch (_: Exception) { "Unknown" }
    }

    private fun getMemoryInfoStr(): String {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        return "%.1f GB".format(mi.totalMem / 1024.0 / 1024.0 / 1024.0)
    }

    private fun getDiskInfoStr(): String {
        val stat = StatFs(Environment.getDataDirectory().path)
        return "%.1f GB".format(stat.blockCountLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0)
    }

    private fun getNetworkInfoStr(): String {
        val types = mutableListOf<String>()
        try {
            java.net.NetworkInterface.getNetworkInterfaces()?.asSequence()
                ?.filter { it.isUp && !it.isLoopback }
                ?.forEach { iface ->
                    val name = iface.name.lowercase()
                    when {
                        name.startsWith("wlan") || name.startsWith("wifi") -> types += "WiFi(${iface.name})"
                        name.startsWith("eth") -> types += "以太网(${iface.name})"
                        name.startsWith("rmnet") || name.startsWith("ccmni") -> types += "移动网络(${iface.name})"
                        name.startsWith("usb") -> types += "USB网络(${iface.name})"
                    }
                }
        } catch (_: Exception) {}
        return if (types.isEmpty()) "无网卡" else types.joinToString(", ")
    }

    private fun getDisplayArray() = Arguments.createArray().also { arr ->
        val dm = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        dm.displays.forEach { display ->
            val metrics = DisplayMetrics().also { display.getRealMetrics(it) }
            arr.pushMap(Arguments.createMap().apply {
                putString("id", display.displayId.toString())
                putString("displayType", if (display.displayId == Display.DEFAULT_DISPLAY) "primary" else "secondary")
                putInt("refreshRate", display.refreshRate.toInt())
                putInt("width", metrics.widthPixels)
                putInt("height", metrics.heightPixels)
                putInt("physicalWidth", ((metrics.widthPixels / metrics.xdpi) * 25.4).toInt())
                putInt("physicalHeight", ((metrics.heightPixels / metrics.ydpi) * 25.4).toInt())
                putBoolean("touchSupport", true)
            })
        }
    }

    // ─── SystemStatus ─────────────────────────────────────────────────────────

    fun getSystemStatus(): WritableMap = Arguments.createMap().apply {
        putMap("cpu", getCpuUsage())
        putMap("memory", getMemoryUsage())
        putMap("disk", getDiskUsage())
        putMap("power", getPowerStatus())
        putArray("usbDevices", getUsbDevices())
        putArray("bluetoothDevices", getBluetoothDevices())
        putArray("serialDevices", getSerialDevices())
        putArray("networks", getNetworks())
        putArray("installedApps", getInstalledApps())
        putDouble("updatedAt", System.currentTimeMillis().toDouble())
    }

    private fun getCpuUsage(): WritableMap {
        val prev = lastCpuStat
        val curr = readProcStat()
        lastCpuStat = curr
        val totalDelta = curr.sum() - prev.sum()
        val idleDelta = curr[3] - prev[3]
        val usage = if (totalDelta > 0) (1.0 - idleDelta.toDouble() / totalDelta) * 100.0 else 0.0
        return Arguments.createMap().apply {
            putDouble("app", usage)
            putInt("cores", Runtime.getRuntime().availableProcessors())
        }
    }

    private fun getMemoryUsage(): WritableMap {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val totalMB = mi.totalMem / 1024 / 1024
        val appMB = am.getProcessMemoryInfo(intArrayOf(android.os.Process.myPid()))
            .firstOrNull()?.totalPss?.div(1024) ?: 0
        return Arguments.createMap().apply {
            putDouble("total", totalMB.toDouble())
            putDouble("app", appMB.toDouble())
            putDouble("appPercentage", if (totalMB > 0) appMB * 100.0 / totalMB else 0.0)
        }
    }

    private fun getDiskUsage(): WritableMap {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalGB = stat.blockCountLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val availGB = stat.availableBlocksLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val usedGB = totalGB - availGB
        val appMB = getFolderSize(context.filesDir) / 1024.0 / 1024.0
        return Arguments.createMap().apply {
            putDouble("total", totalGB)
            putDouble("used", usedGB)
            putDouble("available", availGB)
            putDouble("overall", if (totalGB > 0) usedGB / totalGB * 100 else 0.0)
            putDouble("app", appMB)
        }
    }

    private fun getFolderSize(f: java.io.File): Long =
        f.listFiles()?.sumOf { if (it.isDirectory) getFolderSize(it) else it.length() } ?: 0L

    fun getPowerStatus(): WritableMap {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level >= 0 && scale > 0) level * 100 / scale else 0
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        val statusStr = when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
            BatteryManager.BATTERY_STATUS_FULL -> "full"
            BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
            else -> "unknown"
        }
        val health = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
        val healthStr = when (health) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
            BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
            BatteryManager.BATTERY_HEALTH_COLD -> "cold"
            else -> "unknown"
        }
        return Arguments.createMap().apply {
            putBoolean("powerConnected", plugged > 0)
            putBoolean("isCharging", isCharging)
            putInt("batteryLevel", batteryPct)
            putString("batteryStatus", statusStr)
            putString("batteryHealth", healthStr)
        }
    }

    private fun getUsbDevices() = Arguments.createArray().also { arr ->
        try {
            val usbManager = context.getSystemService(Context.USB_SERVICE) as? android.hardware.usb.UsbManager
            usbManager?.deviceList?.values?.forEach { d ->
                arr.pushMap(Arguments.createMap().apply {
                    putString("name", d.deviceName)
                    putString("deviceId", d.deviceId.toString())
                    putString("vendorId", d.vendorId.toString())
                    putString("productId", d.productId.toString())
                    putString("deviceClass", d.deviceClass.toString())
                })
            }
        } catch (_: Exception) {}
    }

    private fun getBluetoothDevices() = Arguments.createArray().also { arr ->
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
                bm?.adapter?.bondedDevices?.forEach { d ->
                    arr.pushMap(Arguments.createMap().apply {
                        putString("name", d.name ?: "Unknown")
                        putString("address", d.address)
                        putString("type", when (d.type) {
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE -> "ble"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                            else -> "unknown"
                        })
                        putBoolean("connected", d.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED)
                    })
                }
            }
        } catch (_: Exception) {}
    }

    private fun getSerialDevices() = Arguments.createArray().also { arr ->
        try {
            java.io.File("/dev").listFiles { f ->
                f.name.startsWith("ttyS") || f.name.startsWith("ttyUSB") || f.name.startsWith("ttyACM")
            }?.forEach { f ->
                arr.pushMap(Arguments.createMap().apply {
                    putString("name", f.name)
                    putString("path", f.absolutePath)
                    putBoolean("isOpen", false)
                })
            }
        } catch (_: Exception) {}
    }

    private fun getNetworks() = Arguments.createArray().also { arr ->
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            @Suppress("DEPRECATION")
            val info = cm.activeNetworkInfo
            if (info?.isConnected == true) {
                arr.pushMap(Arguments.createMap().apply {
                    @Suppress("DEPRECATION")
                    putString("type", when (info.type) {
                        ConnectivityManager.TYPE_WIFI -> "wifi"
                        ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                        ConnectivityManager.TYPE_MOBILE -> "mobile"
                        ConnectivityManager.TYPE_VPN -> "vpn"
                        else -> "unknown"
                    })
                    putString("name", info.extraInfo ?: "")
                    putString("ipAddress", getIpAddress())
                    putString("gateway", "")
                    putString("netmask", "")
                    putArray("dns", Arguments.createArray())
                    putBoolean("connected", true)
                })
            }
        } catch (_: Exception) {}
    }

    private fun getIpAddress(): String = try {
        java.net.NetworkInterface.getNetworkInterfaces().asSequence()
            .flatMap { it.inetAddresses.asSequence() }
            .firstOrNull { !it.isLoopbackAddress && it is java.net.Inet4Address }
            ?.hostAddress ?: ""
    } catch (_: Exception) { "" }

    private fun getInstalledApps() = Arguments.createArray().also { arr ->
        try {
            context.packageManager.getInstalledPackages(0).forEach { pkg ->
                val ai = pkg.applicationInfo ?: return@forEach
                arr.pushMap(Arguments.createMap().apply {
                    putString("packageName", pkg.packageName)
                    putString("appName", ai.loadLabel(context.packageManager).toString())
                    putString("versionName", pkg.versionName ?: "")
                    putInt("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                        pkg.longVersionCode.toInt() else @Suppress("DEPRECATION") pkg.versionCode)
                    putDouble("installTime", pkg.firstInstallTime.toDouble())
                    putDouble("updateTime", pkg.lastUpdateTime.toDouble())
                    putBoolean("isSystemApp", (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0)
                })
            }
        } catch (_: Exception) {}
    }
}
