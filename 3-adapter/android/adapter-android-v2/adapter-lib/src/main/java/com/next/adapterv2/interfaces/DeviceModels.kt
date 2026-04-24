package com.next.adapterv2.interfaces

/**
 * 设备静态信息快照。
 */
data class DeviceInfo(
  val id: String,
  val manufacturer: String,
  val os: String,
  val osVersion: String,
  val cpu: String,
  val memory: String,
  val disk: String,
  val network: String,
  val displays: List<DisplayInfo>
)

/**
 * 单块屏幕的描述信息。
 */
data class DisplayInfo(
  val id: String,
  val displayType: String,
  val refreshRate: Int,
  val width: Int,
  val height: Int,
  val physicalWidth: Int,
  val physicalHeight: Int,
  val touchSupport: Boolean
)

/**
 * 系统状态总快照。
 *
 * 这是一个面向诊断和验证的聚合模型，用于一次性返回当前设备的关键系统态。
 */
data class SystemStatus(
  val cpu: CpuUsage,
  val memory: MemoryUsage,
  val disk: DiskUsage,
  val power: PowerStatus,
  val usbDevices: List<UsbDevice>,
  val bluetoothDevices: List<BluetoothDevice>,
  val serialDevices: List<SerialDevice>,
  val networks: List<NetworkConnection>,
  val installedApps: List<InstalledApp>,
  val updatedAt: Long
)

/**
 * CPU 使用信息。
 */
data class CpuUsage(
  val app: Double,
  val cores: Int
)

/**
 * 内存使用信息。
 */
data class MemoryUsage(
  val total: Double,
  val app: Double,
  val appPercentage: Double
)

/**
 * 存储使用信息。
 */
data class DiskUsage(
  val total: Double,
  val used: Double,
  val available: Double,
  val overall: Double,
  val app: Double
)

/**
 * 当前电源状态。
 */
data class PowerStatus(
  val powerConnected: Boolean,
  val isCharging: Boolean,
  val batteryLevel: Int,
  val batteryStatus: String,
  val batteryHealth: String
)

/**
 * 电源状态变化事件。
 */
data class PowerStatusChangeEvent(
  val powerConnected: Boolean,
  val isCharging: Boolean,
  val batteryLevel: Int,
  val batteryStatus: String,
  val batteryHealth: String,
  val timestamp: Long
)

/**
 * USB 设备描述。
 */
data class UsbDevice(
  val name: String,
  val deviceId: String,
  val vendorId: String,
  val productId: String,
  val deviceClass: String
)

/**
 * 蓝牙设备描述。
 */
data class BluetoothDevice(
  val name: String,
  val address: String,
  val type: String,
  val connected: Boolean
)

/**
 * 串口设备描述。
 */
data class SerialDevice(
  val name: String,
  val path: String,
  val isOpen: Boolean
)

/**
 * 网络连接描述。
 */
data class NetworkConnection(
  val type: String,
  val name: String,
  val ipAddress: String,
  val gateway: String,
  val netmask: String,
  val dns: List<String>,
  val connected: Boolean
)

/**
 * 已安装应用描述。
 */
data class InstalledApp(
  val packageName: String,
  val appName: String,
  val versionName: String,
  val versionCode: Int,
  val installTime: Long,
  val updateTime: Long,
  val isSystemApp: Boolean
)
