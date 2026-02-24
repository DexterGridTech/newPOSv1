package com.impos2.posadapter.turbomodules.device

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
import android.util.DisplayMetrics
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import java.security.SecureRandom

class DeviceManager private constructor(private val context: Context) {

    companion object {
        @Volatile private var instance: DeviceManager? = null
        fun getInstance(context: Context): DeviceManager =
            instance ?: synchronized(this) {
                instance ?: DeviceManager(context.applicationContext).also { instance = it }
            }

        private fun readProcStat(): LongArray {
            // [user, nice, system, idle, iowait, irq, softirq]
            return try {
                val line = java.io.File("/proc/stat").bufferedReader().readLine() ?: return LongArray(7)
                line.trim().split("\\s+".toRegex()).drop(1).take(7).map { it.toLong() }.toLongArray()
            } catch (_: Exception) { LongArray(7) }
        }

        private const val PREFS_NAME = "device_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        // 字符集：0-9 + A-Z 排除 I/O（共34个字符）
        private const val CHARSET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        private const val DEVICE_ID_LENGTH = 10
    }

    @Volatile private var lastCpuStat: LongArray = readProcStat()
    @Volatile private var lastCpuTime: Long = System.currentTimeMillis()

    // ─── DeviceID Generation ──────────────────────────────────────────────────

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
        val freqStr = getCpuFreqStr(cores)
        return "${Build.HARDWARE}, ${cores}核, $freqStr"
    }

    private fun getCpuFreqStr(cores: Int): String {
        // 优先读取 cpufreq 文件（单位 kHz）
        val freqKHz = (0 until cores).mapNotNull {
            listOf(
                "/sys/devices/system/cpu/cpu$it/cpufreq/cpuinfo_max_freq",
                "/sys/devices/system/cpu/cpu$it/cpufreq/scaling_max_freq"
            ).firstNotNullOfOrNull { path ->
                val f = java.io.File(path)
                if (f.exists()) f.readText().trim().toLongOrNull()?.takeIf { v -> v > 1000 } else null
            }
        }.maxOrNull()
        if (freqKHz != null) return "${freqKHz / 1000} MHz"

        // 备用：从 /proc/cpuinfo 读取 "cpu MHz" 或 "BogoMIPS"
        return try {
            var mhz: Double? = null
            var bogomips: Double? = null
            java.io.File("/proc/cpuinfo").bufferedReader().forEachLine { line ->
                when {
                    line.startsWith("cpu MHz", ignoreCase = true) ->
                        mhz = mhz ?: line.substringAfter(":").trim().toDoubleOrNull()
                    line.startsWith("BogoMIPS", ignoreCase = true) ->
                        bogomips = bogomips ?: line.substringAfter(":").trim().toDoubleOrNull()
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

        val prevTotal = prev.sum()
        val currTotal = curr.sum()
        val totalDelta = currTotal - prevTotal
        // idle = index 3
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
        // powerConnected: 电源物理连接状态，plugged > 0 表示有电源接入（不管是否在充电）
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val powerConnected = plugged > 0
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
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
            putBoolean("powerConnected", powerConnected)
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

    private fun getIpAddress(): String {
        return try {
            java.net.NetworkInterface.getNetworkInterfaces().asSequence()
                .flatMap { it.inetAddresses.asSequence() }
                .firstOrNull { !it.isLoopbackAddress && it is java.net.Inet4Address }
                ?.hostAddress ?: ""
        } catch (_: Exception) { "" }
    }

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
