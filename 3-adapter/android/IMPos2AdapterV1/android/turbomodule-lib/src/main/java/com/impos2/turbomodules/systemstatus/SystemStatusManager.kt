package com.impos2.turbomodules.systemstatus

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * 系统状态管理器（单例模式）
 *
 * 优化点:
 * 1. 支持多 ReactInstanceManager 场景
 * 2. 线程安全的状态采集
 * 3. 完整的系统信息收集
 */
class SystemStatusManager private constructor(private val context: Context) {

    companion object {
        private const val TAG = "SystemStatusManager"

        @Volatile
        private var instance: SystemStatusManager? = null

        fun getInstance(context: Context): SystemStatusManager {
            return instance ?: synchronized(this) {
                instance ?: SystemStatusManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val cpuCalculator = CpuUsageCalculator()

    /**
     * 获取完整的系统状态
     */
    fun getSystemStatus(): WritableMap {
        return Arguments.createMap().apply {
            putMap("cpu", getCpuUsage())
            putMap("memory", getMemoryUsage())
            putMap("disk", getDiskUsage())
            putMap("power", getPowerStatus())
            putMap("gps", getGpsLocation())
            putArray("usbDevices", getUsbDevices())
            putArray("bluetoothDevices", getBluetoothDevices())
            putArray("serialDevices", getSerialDevices())
            putArray("networks", getNetworks())
            putArray("installedApps", getInstalledApps())
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
    }

    /**
     * 获取 CPU 使用情况
     */
    private fun getCpuUsage(): WritableMap {
        return Arguments.createMap().apply {
            val cpuUsage = cpuCalculator.getCpuUsage()
            putDouble("overall", cpuUsage.overall)
            putDouble("app", cpuUsage.app)
            putInt("cores", cpuUsage.cores)
        }
    }

    /**
     * 获取内存使用情况
     */
    private fun getMemoryUsage(): WritableMap {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val totalMB = memInfo.totalMem / (1024 * 1024)
        val availableMB = memInfo.availMem / (1024 * 1024)
        val usedMB = totalMB - availableMB

        // 获取应用内存
        val processMemInfo = activityManager.getProcessMemoryInfo(intArrayOf(android.os.Process.myPid()))
        val appMB = if (processMemInfo.isNotEmpty()) processMemInfo[0].totalPss / 1024 else 0

        return Arguments.createMap().apply {
            putDouble("total", totalMB.toDouble())
            putDouble("used", usedMB.toDouble())
            putDouble("available", availableMB.toDouble())
            putDouble("overall", if (totalMB > 0) ((usedMB.toDouble() / totalMB.toDouble()) * 100) else 0.0)
            putDouble("app", appMB.toDouble())
            putDouble("appPercentage", if (totalMB > 0) ((appMB.toDouble() / totalMB.toDouble()) * 100) else 0.0)
        }
    }

    /**
     * 获取磁盘使用情况
     */
    private fun getDiskUsage(): WritableMap {
        val stat = android.os.StatFs(android.os.Environment.getDataDirectory().path)
        val totalGB = (stat.blockCountLong * stat.blockSizeLong) / (1024 * 1024 * 1024)
        val availableGB = (stat.availableBlocksLong * stat.blockSizeLong) / (1024 * 1024 * 1024)
        val usedGB = totalGB - availableGB

        val appDir = context.filesDir
        val appSizeMB = getFolderSize(appDir) / (1024 * 1024)

        return Arguments.createMap().apply {
            putDouble("total", totalGB.toDouble())
            putDouble("used", usedGB.toDouble())
            putDouble("available", availableGB.toDouble())
            putDouble("overall", if (totalGB > 0) ((usedGB.toDouble() / totalGB.toDouble()) * 100) else 0.0)
            putDouble("app", appSizeMB.toDouble())
        }
    }

    /**
     * 递归计算文件夹大小
     */
    private fun getFolderSize(folder: java.io.File): Long {
        var size: Long = 0
        try {
            val files = folder.listFiles()
            if (files != null) {
                for (file in files) {
                    size += if (file.isDirectory) {
                        getFolderSize(file)
                    } else {
                        file.length()
                    }
                }
            }
        } catch (e: Exception) {
            // 忽略权限错误
        }
        return size
    }

    /**
     * 获取电源状态
     */
    private fun getPowerStatus(): WritableMap {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct = if (level >= 0 && scale > 0) (level * 100 / scale) else 0

        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

        val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        val powerConnected = plugged > 0

        val statusStr = when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
            BatteryManager.BATTERY_STATUS_FULL -> "full"
            BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
            else -> "unknown"
        }

        val health = batteryIntent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
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

    /**
     * 获取 GPS 定位信息
     */
    private fun getGpsLocation(): WritableMap {
        val map = Arguments.createMap()
        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

            // 权限检查
            val hasFineLocationPermission = context.checkSelfPermission(
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val hasCoarseLocationPermission = context.checkSelfPermission(
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            // 检查 GPS 和网络定位是否启用
            val isGpsEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) ?: false
            val isNetworkEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ?: false

            // 无权限处理
            if (!hasFineLocationPermission && !hasCoarseLocationPermission) {
                map.putBoolean("available", false)
                map.putDouble("latitude", 0.0)
                map.putDouble("longitude", 0.0)
                map.putDouble("altitude", 0.0)
                map.putDouble("accuracy", 0.0)
                map.putDouble("speed", 0.0)
                map.putDouble("bearing", 0.0)
                map.putString("provider", "no_permission")
                map.putDouble("timestamp", 0.0)
                return map
            }

            // 定位未启用处理
            if (!isGpsEnabled && !isNetworkEnabled) {
                map.putBoolean("available", false)
                map.putDouble("latitude", 0.0)
                map.putDouble("longitude", 0.0)
                map.putDouble("altitude", 0.0)
                map.putDouble("accuracy", 0.0)
                map.putDouble("speed", 0.0)
                map.putDouble("bearing", 0.0)
                map.putString("provider", "disabled")
                map.putDouble("timestamp", 0.0)
                return map
            }

            // 获取最后已知位置
            var location: Location? = null
            if (isGpsEnabled && hasFineLocationPermission) {
                location = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            }
            if (location == null && isNetworkEnabled) {
                location = locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            }

            if (location != null) {
                map.putBoolean("available", true)
                map.putDouble("latitude", location.latitude)
                map.putDouble("longitude", location.longitude)
                map.putDouble("altitude", location.altitude)
                map.putDouble("accuracy", location.accuracy.toDouble())
                map.putDouble("speed", location.speed.toDouble())
                map.putDouble("bearing", location.bearing.toDouble())
                map.putString("provider", location.provider ?: "unknown")
                map.putDouble("timestamp", location.time.toDouble())
            } else {
                map.putBoolean("available", false)
                map.putDouble("latitude", 0.0)
                map.putDouble("longitude", 0.0)
                map.putDouble("altitude", 0.0)
                map.putDouble("accuracy", 0.0)
                map.putDouble("speed", 0.0)
                map.putDouble("bearing", 0.0)
                map.putString("provider", "no_location")
                map.putDouble("timestamp", 0.0)
            }
        } catch (e: Exception) {
            map.putBoolean("available", false)
            map.putDouble("latitude", 0.0)
            map.putDouble("longitude", 0.0)
            map.putDouble("altitude", 0.0)
            map.putDouble("accuracy", 0.0)
            map.putDouble("speed", 0.0)
            map.putDouble("bearing", 0.0)
            map.putString("provider", "error")
            map.putDouble("timestamp", 0.0)
        }
        return map
    }

    /**
     * 获取 USB 设备列表
     */
    private fun getUsbDevices(): WritableArray {
        val array = Arguments.createArray()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val usbManager = context.getSystemService(Context.USB_SERVICE) as? android.hardware.usb.UsbManager
                val deviceList = usbManager?.deviceList
                deviceList?.values?.forEach { device ->
                    val deviceMap = Arguments.createMap().apply {
                        putString("name", device.deviceName)
                        putString("deviceId", device.deviceId.toString())
                        putString("vendorId", device.vendorId.toString())
                        putString("productId", device.productId.toString())
                        putString("deviceClass", device.deviceClass.toString())
                    }
                    array.pushMap(deviceMap)
                }
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return array
    }

    /**
     * 获取蓝牙设备列表
     */
    private fun getBluetoothDevices(): WritableArray {
        val array = Arguments.createArray()
        try {
            if (context.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED ||
                Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager
                val bluetoothAdapter = bluetoothManager?.adapter
                val bondedDevices = bluetoothAdapter?.bondedDevices
                bondedDevices?.forEach { device ->
                    val deviceMap = Arguments.createMap().apply {
                        putString("name", device.name ?: "Unknown")
                        putString("address", device.address)
                        putString("type", when (device.type) {
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE -> "ble"
                            android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                            else -> "unknown"
                        })
                        putBoolean("connected", device.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED)
                    }
                    array.pushMap(deviceMap)
                }
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return array
    }

    /**
     * 获取串口设备列表
     */
    private fun getSerialDevices(): WritableArray {
        val array = Arguments.createArray()
        try {
            val serialDir = java.io.File("/dev")
            val serialFiles = serialDir.listFiles { file ->
                file.name.startsWith("ttyS") || file.name.startsWith("ttyUSB") || file.name.startsWith("ttyACM")
            }
            serialFiles?.forEach { file ->
                val deviceMap = Arguments.createMap().apply {
                    putString("name", file.name)
                    putString("path", file.absolutePath)
                    putBoolean("isOpen", false)
                }
                array.pushMap(deviceMap)
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return array
    }

    /**
     * 获取网络连接列表
     */
    private fun getNetworks(): WritableArray {
        val array = Arguments.createArray()
        try {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            val activeNetwork = connectivityManager?.activeNetworkInfo

            if (activeNetwork != null && activeNetwork.isConnected) {
                val networkMap = Arguments.createMap().apply {
                    putString("type", when (activeNetwork.type) {
                        android.net.ConnectivityManager.TYPE_WIFI -> "wifi"
                        android.net.ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                        android.net.ConnectivityManager.TYPE_MOBILE -> "mobile"
                        android.net.ConnectivityManager.TYPE_VPN -> "vpn"
                        else -> "unknown"
                    })
                    putString("name", activeNetwork.extraInfo ?: "Unknown")
                    putString("ipAddress", getIpAddress())
                    putString("gateway", "")
                    putString("netmask", "")
                    putArray("dns", Arguments.createArray())
                    putBoolean("connected", true)
                }
                array.pushMap(networkMap)
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return array
    }

    /**
     * 获取 IP 地址
     */
    private fun getIpAddress(): String {
        try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (!address.isLoopbackAddress && address is java.net.Inet4Address) {
                        return address.hostAddress ?: ""
                    }
                }
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return ""
    }

    /**
     * 获取已安装应用列表
     */
    private fun getInstalledApps(): WritableArray {
        val array = Arguments.createArray()
        try {
            val packageManager = context.packageManager
            val packages = packageManager.getInstalledPackages(0)

            packages.forEach { packageInfo ->
                val appInfo = packageInfo.applicationInfo
                if (appInfo != null) {
                    val appMap = Arguments.createMap().apply {
                        putString("packageName", packageInfo.packageName)
                        putString("appName", appInfo.loadLabel(packageManager).toString())
                        putString("versionName", packageInfo.versionName ?: "")
                        putInt("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            packageInfo.longVersionCode.toInt()
                        } else {
                            @Suppress("DEPRECATION")
                            packageInfo.versionCode
                        })
                        putDouble("installTime", packageInfo.firstInstallTime.toDouble())
                        putDouble("updateTime", packageInfo.lastUpdateTime.toDouble())
                        putBoolean("isSystemApp", (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0)
                    }
                    array.pushMap(appMap)
                }
            }
        } catch (e: Exception) {
            // 忽略错误
        }
        return array
    }
}
