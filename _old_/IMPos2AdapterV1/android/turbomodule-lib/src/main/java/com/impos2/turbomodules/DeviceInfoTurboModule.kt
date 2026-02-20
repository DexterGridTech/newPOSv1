package com.impos2.turbomodules

import android.app.ActivityManager
import android.content.Context
import android.hardware.display.DisplayManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.DisplayMetrics
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.RandomAccessFile

class DeviceInfoTurboModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DeviceInfoTurboModule"
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            val deviceInfo: WritableMap = Arguments.createMap()

            // 按照 DeviceInfo 接口定义返回字段
            deviceInfo.putString("id", Build.ID)
            deviceInfo.putString("manufacturer", Build.MANUFACTURER)
            deviceInfo.putString("os", "Android")
            deviceInfo.putString("osVersion", Build.VERSION.RELEASE)
            deviceInfo.putString("cpu", getCpuInfo())
            deviceInfo.putString("memory", getMemoryInfo())
            deviceInfo.putString("disk", getDiskInfo())
            deviceInfo.putString("network", getNetworkInfo())
            deviceInfo.putArray("displays", getDisplayInfoArray())

            promise.resolve(deviceInfo)
        } catch (e: Exception) {
            promise.reject("DEVICE_INFO_ERROR", "获取设备信息失败: ${e.message}", e)
        }
    }

    private fun getCpuInfo(): String {
        return try {
            val brand = Build.BRAND
            val model = Build.MODEL
            val hardware = Build.HARDWARE
            val cores = Runtime.getRuntime().availableProcessors()
            val frequency = getCpuMaxFrequency()

            "品牌: $brand, 型号: $model, 硬件: $hardware, 内核数: $cores, 主频: $frequency"
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun getCpuMaxFrequency(): String {
        return try {
            var maxFreq = 0L
            val cores = Runtime.getRuntime().availableProcessors()

            for (i in 0 until cores) {
                val file = File("/sys/devices/system/cpu/cpu$i/cpufreq/cpuinfo_max_freq")
                if (file.exists()) {
                    val freq = file.readText().trim().toLongOrNull() ?: 0L
                    if (freq > maxFreq) {
                        maxFreq = freq
                    }
                }
            }

            if (maxFreq > 0) {
                "${maxFreq / 1000} MHz"
            } else {
                "Unknown"
            }
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun getMemoryInfo(): String {
        return try {
            val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memoryInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memoryInfo)

            val totalMemoryGB = memoryInfo.totalMem / (1024.0 * 1024.0 * 1024.0)
            val availMemoryGB = memoryInfo.availMem / (1024.0 * 1024.0 * 1024.0)

            "总内存: %.2f GB (可用: %.2f GB)".format(totalMemoryGB, availMemoryGB)
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun getDiskInfo(): String {
        return try {
            val internalPath = Environment.getDataDirectory()
            val internalStat = StatFs(internalPath.path)
            val internalTotalGB = (internalStat.blockCountLong * internalStat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)
            val internalAvailGB = (internalStat.availableBlocksLong * internalStat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)

            "总存储: %.2f GB (可用: %.2f GB)".format(internalTotalGB, internalAvailGB)
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun getDisplayInfoArray(): WritableArray {
        return try {
            val displayManager = reactApplicationContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
            val displays = displayManager.displays

            val displayArray: WritableArray = Arguments.createArray()

            if (displays.isEmpty()) {
                return displayArray
            }

            displays.forEach { display ->
                val metrics = DisplayMetrics()
                display.getRealMetrics(metrics)

                val displayInfo: WritableMap = Arguments.createMap()

                // 按照 DisplayInfo 接口定义返回字段
                displayInfo.putString("id", display.displayId.toString())
                displayInfo.putString("displayType", getDisplayType(display))
                displayInfo.putInt("refreshRate", display.refreshRate.toInt())
                displayInfo.putInt("width", metrics.widthPixels)
                displayInfo.putInt("height", metrics.heightPixels)
                displayInfo.putDouble("physicalWidth", (metrics.widthPixels / metrics.xdpi) * 25.4)
                displayInfo.putDouble("physicalHeight", (metrics.heightPixels / metrics.ydpi) * 25.4)
                displayInfo.putString("orientation", getOrientation(display))
                displayInfo.putBoolean("isMobile", isMobileDevice())

                displayArray.pushMap(displayInfo)
            }

            displayArray
        } catch (e: Exception) {
            Arguments.createArray()
        }
    }

    private fun getNetworkInfo(): String {
        return try {
            val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = connectivityManager.activeNetwork
                val capabilities = connectivityManager.getNetworkCapabilities(network)

                if (capabilities == null) {
                    return "未连接"
                }

                val networkType = when {
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WiFi"
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "移动网络"
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "以太网"
                    else -> "其他"
                }

                val downSpeed = capabilities.linkDownstreamBandwidthKbps / 1024
                val upSpeed = capabilities.linkUpstreamBandwidthKbps / 1024

                var networkInfo = "类型: $networkType"

                if (networkType == "WiFi") {
                    val wifiInfo = getWifiInfo()
                    if (wifiInfo.isNotEmpty()) {
                        networkInfo += ", $wifiInfo"
                    }
                }

                if (downSpeed > 0 || upSpeed > 0) {
                    networkInfo += ", 下行: ${downSpeed}Mbps, 上行: ${upSpeed}Mbps"
                }

                networkInfo
            } else {
                @Suppress("DEPRECATION")
                val networkInfo = connectivityManager.activeNetworkInfo
                if (networkInfo?.isConnected == true) {
                    "类型: ${networkInfo.typeName}"
                } else {
                    "未连接"
                }
            }
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun getWifiInfo(): String {
        return try {
            val wifiManager = reactApplicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiInfo = wifiManager.connectionInfo

            if (wifiInfo != null) {
                val ssid = wifiInfo.ssid?.replace("\"", "") ?: "Unknown"
                val rssi = wifiInfo.rssi
                val linkSpeed = wifiInfo.linkSpeed

                "SSID: $ssid, 信号: ${rssi}dBm, 速率: ${linkSpeed}Mbps"
            } else {
                ""
            }
        } catch (e: Exception) {
            ""
        }
    }

    private fun getDisplayType(display: Display): String {
        return when {
            display.displayId == Display.DEFAULT_DISPLAY -> "primary"
            else -> "secondary"
        }
    }

    private fun getOrientation(display: Display): String {
        return when (display.rotation) {
            0 -> "portrait"
            1 -> "landscape"
            2 -> "portrait-reverse"
            3 -> "landscape-reverse"
            else -> "unknown"
        }
    }

    private fun isMobileDevice(): Boolean {
        return try {
            val configuration = reactApplicationContext.resources.configuration
            val uiMode = configuration.uiMode and android.content.res.Configuration.UI_MODE_TYPE_MASK

            // 判断设备类型
            when (uiMode) {
                android.content.res.Configuration.UI_MODE_TYPE_NORMAL -> {
                    // 普通设备（手机或平板），通过屏幕尺寸进一步判断
                    val screenLayout = configuration.screenLayout and android.content.res.Configuration.SCREENLAYOUT_SIZE_MASK
                    // 小屏和普通屏认为是手机，大屏和超大屏认为是平板/laptop
                    screenLayout <= android.content.res.Configuration.SCREENLAYOUT_SIZE_NORMAL
                }
                android.content.res.Configuration.UI_MODE_TYPE_TELEVISION,
                android.content.res.Configuration.UI_MODE_TYPE_DESK -> false // TV 和桌面设备
                else -> true // 其他情况默认为移动设备
            }
        } catch (e: Exception) {
            true // 出错时默认为移动设备
        }
    }
}
