package com.impos2.adapter.device

import android.app.ActivityManager
import android.content.BroadcastReceiver
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
import com.impos2.adapter.interfaces.BluetoothDevice
import com.impos2.adapter.interfaces.CpuUsage
import com.impos2.adapter.interfaces.DeviceInfo
import com.impos2.adapter.interfaces.DisplayInfo
import com.impos2.adapter.interfaces.DiskUsage
import com.impos2.adapter.interfaces.IDeviceManager
import com.impos2.adapter.interfaces.InstalledApp
import com.impos2.adapter.interfaces.MemoryUsage
import com.impos2.adapter.interfaces.NetworkConnection
import com.impos2.adapter.interfaces.PowerStatus
import com.impos2.adapter.interfaces.PowerStatusChangeEvent
import com.impos2.adapter.interfaces.SerialDevice
import com.impos2.adapter.interfaces.SystemStatus
import com.impos2.adapter.interfaces.UsbDevice
import java.io.File
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * 设备信息与系统状态管理器。
 *
 * 它负责对 Android 设备侧的信息采集做统一封装，包括：
 * - 基础设备标识、型号、屏幕信息；
 * - 网络、电源、电池等系统状态；
 * - 电源变化监听与事件分发。
 *
 * 设计原则：
 * - 统一从这里读设备态，避免上层到处直接碰系统 API；
 * - 对高风险 API 做兜底，减少 ROM 差异导致的崩溃；
 * - 为 TurboModule 与测试页提供稳定模型对象。
 */
class DeviceManager private constructor(private val context: Context) : IDeviceManager {

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

    private fun readProcStat(): LongArray = try {
      val line = File("/proc/stat").bufferedReader().readLine() ?: return LongArray(7)
      line.trim().split("\\s+".toRegex()).drop(1).take(7).map { it.toLong() }.toLongArray()
    } catch (_: Exception) {
      LongArray(7)
    }
  }

  // 电源状态监听器表。使用并发 map，保证注册/取消监听与系统回调并发时仍然安全。
  private val powerListeners = ConcurrentHashMap<String, (PowerStatusChangeEvent) -> Unit>()

  @Volatile
  private var powerReceiverRegistered = false

  @Volatile
  private var lastCpuStat: LongArray = readProcStat()

  private val powerReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent == null) return
      emitPowerStatusChange(readPowerStatusEvent(intent))
    }
  }

  override fun getDeviceInfo(): DeviceInfo {
    return DeviceInfo(
      id = getOrGenerateDeviceId(),
      manufacturer = Build.MANUFACTURER,
      os = "Android",
      osVersion = Build.VERSION.RELEASE,
      cpu = getCpuInfo(),
      memory = getMemoryInfoStr(),
      disk = getDiskInfoStr(),
      network = getNetworkInfoStr(),
      displays = getDisplayList()
    )
  }

  override fun getSystemStatus(): SystemStatus {
    return SystemStatus(
      cpu = getCpuUsage(),
      memory = getMemoryUsage(),
      disk = getDiskUsage(),
      power = getPowerStatus(),
      usbDevices = getUsbDevices(),
      bluetoothDevices = getBluetoothDevices(),
      serialDevices = getSerialDevices(),
      networks = getNetworks(),
      installedApps = getInstalledApps(),
      updatedAt = System.currentTimeMillis()
    )
  }

  override fun getPowerStatus(): PowerStatus {
    val event = readPowerStatusEvent()
    return PowerStatus(
      powerConnected = event.powerConnected,
      isCharging = event.isCharging,
      batteryLevel = event.batteryLevel,
      batteryStatus = event.batteryStatus,
      batteryHealth = event.batteryHealth
    )
  }

  override fun addPowerStatusChangeListener(listener: (PowerStatusChangeEvent) -> Unit): String {
    val listenerId = UUID.randomUUID().toString()
    powerListeners[listenerId] = listener
    ensurePowerReceiverRegistered()
    listener(readPowerStatusEvent())
    return listenerId
  }

  override fun removePowerStatusChangeListener(listenerId: String) {
    powerListeners.remove(listenerId)
    if (powerListeners.isEmpty()) {
      unregisterPowerReceiverIfNeeded()
    }
  }

  private fun ensurePowerReceiverRegistered() {
    if (powerReceiverRegistered) return
    synchronized(this) {
      if (powerReceiverRegistered) return
      val filter = IntentFilter().apply {
        addAction(Intent.ACTION_BATTERY_CHANGED)
        addAction(Intent.ACTION_POWER_CONNECTED)
        addAction(Intent.ACTION_POWER_DISCONNECTED)
      }
      context.registerReceiver(powerReceiver, filter)
      powerReceiverRegistered = true
    }
  }

  private fun unregisterPowerReceiverIfNeeded() {
    if (!powerReceiverRegistered) return
    synchronized(this) {
      if (!powerReceiverRegistered || powerListeners.isNotEmpty()) return
      runCatching { context.unregisterReceiver(powerReceiver) }
      powerReceiverRegistered = false
    }
  }

  private fun emitPowerStatusChange(event: PowerStatusChangeEvent) {
    powerListeners.values.forEach { listener ->
      runCatching { listener(event) }
    }
  }

  private fun readPowerStatusEvent(intent: Intent? = null): PowerStatusChangeEvent {
    val batteryIntent = intent ?: context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val health = batteryIntent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
    val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
    val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
      status == BatteryManager.BATTERY_STATUS_FULL
    val batteryPct = if (level >= 0 && scale > 0) level * 100 / scale else 0

    return PowerStatusChangeEvent(
      powerConnected = plugged != 0,
      isCharging = isCharging,
      batteryLevel = batteryPct,
      batteryStatus = mapBatteryStatus(status),
      batteryHealth = mapBatteryHealth(health),
      timestamp = System.currentTimeMillis()
    )
  }

  private fun mapBatteryStatus(status: Int): String {
    return when (status) {
      BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
      BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
      BatteryManager.BATTERY_STATUS_FULL -> "full"
      BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
      else -> "unknown"
    }
  }

  private fun mapBatteryHealth(health: Int): String {
    return when (health) {
      BatteryManager.BATTERY_HEALTH_GOOD -> "good"
      BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
      BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
      BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
      BatteryManager.BATTERY_HEALTH_COLD -> "cold"
      else -> "unknown"
    }
  }

  private fun getOrGenerateDeviceId(): String {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotEmpty() }
      ?: generateDeviceId().also { prefs.edit().putString(KEY_DEVICE_ID, it).apply() }
  }

  private fun generateDeviceId(): String {
    val androidId =
      Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        ?: "unknown_device"

    return try {
      val hash = MessageDigest.getInstance("SHA-256").digest(androidId.toByteArray())
      val hashValue = hash.fold(0L) { acc, b -> (acc * 256 + (b.toInt() and 0xFF)) % Long.MAX_VALUE }
      (0 until DEVICE_ID_LENGTH).map { i ->
        val pos = ((hashValue shr (i * 5)) % CHARSET.length).toInt().let {
          if (it < 0) it + CHARSET.length else it
        }
        CHARSET[pos]
      }.joinToString("")
    } catch (_: Exception) {
      androidId.take(DEVICE_ID_LENGTH).map { c ->
        when {
          c.isDigit() -> c
          c.isLetter() -> c.uppercaseChar()
          else -> CHARSET[c.code % CHARSET.length]
        }
      }.joinToString("").padEnd(DEVICE_ID_LENGTH, '0')
    }
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
        File(path).takeIf { it.exists() }?.readText()?.trim()?.toLongOrNull()?.takeIf { it > 1000 }
      }
    }.maxOrNull()

    if (freqKHz != null) return "${freqKHz / 1000} MHz"

    return try {
      var mhz: Double? = null
      File("/proc/cpuinfo").bufferedReader().forEachLine { line ->
        if (line.startsWith("cpu MHz", ignoreCase = true)) {
          mhz = mhz ?: line.substringAfter(":").trim().toDoubleOrNull()
        }
      }
      if (mhz != null) "%.0f MHz".format(mhz) else "Unknown"
    } catch (_: Exception) {
      "Unknown"
    }
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
      NetworkInterface.getNetworkInterfaces()?.asSequence()
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
    } catch (_: Exception) {
      // no-op
    }
    return if (types.isEmpty()) "无网卡" else types.joinToString(", ")
  }

  private fun getDisplayList(): List<DisplayInfo> {
    val dm = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    return dm.displays.map { display ->
      val metrics = DisplayMetrics().also { display.getRealMetrics(it) }
      DisplayInfo(
        id = display.displayId.toString(),
        displayType = if (display.displayId == Display.DEFAULT_DISPLAY) "primary" else "secondary",
        refreshRate = display.refreshRate.toInt(),
        width = metrics.widthPixels,
        height = metrics.heightPixels,
        physicalWidth = ((metrics.widthPixels / metrics.xdpi) * 25.4).toInt(),
        physicalHeight = ((metrics.heightPixels / metrics.ydpi) * 25.4).toInt(),
        touchSupport = true
      )
    }
  }

  private fun getCpuUsage(): CpuUsage {
    val prev = lastCpuStat
    val curr = readProcStat()
    lastCpuStat = curr
    val totalDelta = curr.sum() - prev.sum()
    val idleDelta = curr[3] - prev[3]
    val usage = if (totalDelta > 0) (1.0 - idleDelta.toDouble() / totalDelta) * 100.0 else 0.0
    return CpuUsage(app = usage, cores = Runtime.getRuntime().availableProcessors())
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
    val appMB = getFolderSize(context.filesDir) / 1024.0 / 1024.0
    return DiskUsage(
      total = totalGB,
      used = usedGB,
      available = availGB,
      overall = if (totalGB > 0) usedGB / totalGB * 100 else 0.0,
      app = appMB
    )
  }

  private fun getFolderSize(file: File): Long {
    return file.listFiles()?.sumOf { if (it.isDirectory) getFolderSize(it) else it.length() } ?: 0L
  }

  private fun getUsbDevices(): List<UsbDevice> {
    return try {
      val usbManager = context.getSystemService(Context.USB_SERVICE) as? android.hardware.usb.UsbManager
      usbManager?.deviceList?.values?.map { device ->
        UsbDevice(
          name = device.deviceName,
          deviceId = device.deviceId.toString(),
          vendorId = device.vendorId.toString(),
          productId = device.productId.toString(),
          deviceClass = device.deviceClass.toString()
        )
      } ?: emptyList()
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun getBluetoothDevices(): List<BluetoothDevice> {
    return try {
      if (
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
      ) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
        bm?.adapter?.bondedDevices?.map { device ->
          BluetoothDevice(
            name = device.name ?: "Unknown",
            address = device.address,
            type = when (device.type) {
              android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
              android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE -> "ble"
              android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
              else -> "unknown"
            },
            connected = device.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED
          )
        } ?: emptyList()
      } else {
        emptyList()
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun getSerialDevices(): List<SerialDevice> {
    return try {
      File("/dev").listFiles { f ->
        f.name.startsWith("ttyS") || f.name.startsWith("ttyUSB") || f.name.startsWith("ttyACM")
      }?.map { file ->
        SerialDevice(name = file.name, path = file.absolutePath, isOpen = false)
      } ?: emptyList()
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun getNetworks(): List<NetworkConnection> {
    return try {
      val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      @Suppress("DEPRECATION")
      val info = cm.activeNetworkInfo

      if (info?.isConnected == true) {
        @Suppress("DEPRECATION")
        val type = when (info.type) {
          ConnectivityManager.TYPE_WIFI -> "wifi"
          ConnectivityManager.TYPE_ETHERNET -> "ethernet"
          ConnectivityManager.TYPE_MOBILE -> "mobile"
          ConnectivityManager.TYPE_VPN -> "vpn"
          else -> "unknown"
        }

        listOf(
          NetworkConnection(
            type = type,
            name = info.extraInfo ?: "",
            ipAddress = getIpAddress(),
            gateway = "",
            netmask = "",
            dns = emptyList(),
            connected = true
          )
        )
      } else {
        emptyList()
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun getIpAddress(): String {
    return try {
      NetworkInterface.getNetworkInterfaces().asSequence()
        .flatMap { it.inetAddresses.asSequence() }
        .firstOrNull { !it.isLoopbackAddress && it is Inet4Address }
        ?.hostAddress ?: ""
    } catch (_: Exception) {
      ""
    }
  }

  private fun getInstalledApps(): List<InstalledApp> {
    return try {
      context.packageManager.getInstalledPackages(0).mapNotNull { pkg ->
        val ai = pkg.applicationInfo ?: return@mapNotNull null
        InstalledApp(
          packageName = pkg.packageName,
          appName = ai.loadLabel(context.packageManager).toString(),
          versionName = pkg.versionName ?: "",
          versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pkg.longVersionCode.toInt()
          } else {
            @Suppress("DEPRECATION")
            pkg.versionCode
          },
          installTime = pkg.firstInstallTime,
          updateTime = pkg.lastUpdateTime,
          isSystemApp = (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
        )
      }
    } catch (_: Exception) {
      emptyList()
    }
  }
}
