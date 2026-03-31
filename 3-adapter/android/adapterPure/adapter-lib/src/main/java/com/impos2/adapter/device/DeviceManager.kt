package com.impos2.adapter.device

import android.app.ActivityManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.Settings
import com.impos2.adapter.interfaces.*
import java.security.MessageDigest

class DeviceManager private constructor(private val context: Context) : IDeviceManager {

    companion object {
        @Volatile
        private var instance: DeviceManager? = null

        fun getInstance(context: Context): IDeviceManager =
            instance ?: synchronized(this) {
                instance ?: DeviceManager(context.applicationContext).also { instance = it }
            }

        private const val PREFS_NAME = "device_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val CHARSET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        private const val DEVICE_ID_LENGTH = 10
    }

    private val powerListeners = mutableListOf<(PowerStatus) -> Unit>()
    private var powerReceiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())
    private var lastPowerConnected: Boolean? = null

    override fun getDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            id = getOrGenerateDeviceId(),
            manufacturer = Build.MANUFACTURER,
            os = "Android",
            osVersion = Build.VERSION.RELEASE,
            cpu = getCpuInfo(),
            memory = getMemoryInfoStr(),
            disk = getDiskInfoStr(),
            network = "Unknown",
            displays = emptyList()
        )
    }

    override fun getSystemStatus(): SystemStatus {
        return SystemStatus(
            cpu = getCpuUsage(),
            memory = getMemoryUsage(),
            disk = getDiskUsage(),
            power = getPowerStatus(),
            usbDevices = emptyList(),
            bluetoothDevices = emptyList(),
            serialDevices = emptyList(),
            networks = emptyList(),
            installedApps = emptyList(),
            updatedAt = System.currentTimeMillis()
        )
    }

    private fun getOrGenerateDeviceId(): String {
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

    private fun getCpuInfo(): String {
        val cores = Runtime.getRuntime().availableProcessors()
        return "${Build.HARDWARE}, ${cores}核"
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

    private fun getCpuUsage(): CpuUsage {
        return CpuUsage(
            app = 0.0,
            cores = Runtime.getRuntime().availableProcessors()
        )
    }

    private fun getMemoryUsage(): MemoryUsage {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val totalMB = mi.totalMem / 1024 / 1024
        val appMB = am.getProcessMemoryInfo(intArrayOf(android.os.Process.myPid()))
            .firstOrNull()?.totalPss?.div(1024) ?: 0
        return MemoryUsage(
            total = totalMB.toDouble(),
            app = appMB.toDouble(),
            appPercentage = if (totalMB > 0) appMB * 100.0 / totalMB else 0.0
        )
    }

    private fun getDiskUsage(): DiskUsage {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalGB = stat.blockCountLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val availGB = stat.availableBlocksLong * stat.blockSizeLong / 1024.0 / 1024.0 / 1024.0
        val usedGB = totalGB - availGB
        return DiskUsage(
            total = totalGB,
            used = usedGB,
            available = availGB,
            overall = if (totalGB > 0) usedGB / totalGB * 100 else 0.0,
            app = 0.0
        )
    }

    private fun getPowerStatus(): PowerStatus {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level >= 0 && scale > 0) level * 100 / scale else 0
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        val health = intent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1

        return PowerStatus(
            powerConnected = plugged > 0,
            isCharging = isCharging,
            batteryLevel = batteryPct,
            batteryStatus = when (status) {
                BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
                BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
                BatteryManager.BATTERY_STATUS_FULL -> "Full"
                BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not Charging"
                else -> "Unknown"
            },
            batteryHealth = when (health) {
                BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
                BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat"
                BatteryManager.BATTERY_HEALTH_DEAD -> "Dead"
                BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over Voltage"
                BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
                else -> "Unknown"
            }
        )
    }

    override fun addPowerStatusListener(listener: (PowerStatus) -> Unit) {
        synchronized(powerListeners) {
            powerListeners.add(listener)
            if (powerReceiver == null) {
                startPowerMonitoring()
            }
        }
    }

    override fun removePowerStatusListener(listener: (PowerStatus) -> Unit) {
        synchronized(powerListeners) {
            powerListeners.remove(listener)
            if (powerListeners.isEmpty() && powerReceiver != null) {
                stopPowerMonitoring()
            }
        }
    }

    private fun startPowerMonitoring() {
        powerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val powerStatus = getPowerStatus()
                if (lastPowerConnected != powerStatus.powerConnected) {
                    lastPowerConnected = powerStatus.powerConnected
                    handler.post {
                        synchronized(powerListeners) {
                            powerListeners.forEach { it(powerStatus) }
                        }
                    }
                }
            }
        }
        context.registerReceiver(powerReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }

    private fun stopPowerMonitoring() {
        powerReceiver?.let {
            context.unregisterReceiver(it)
            powerReceiver = null
        }
    }
}
