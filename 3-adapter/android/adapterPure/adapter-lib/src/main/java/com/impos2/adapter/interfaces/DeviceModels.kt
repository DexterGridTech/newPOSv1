package com.impos2.adapter.interfaces

// DeviceInfo
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

// SystemStatus
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

data class CpuUsage(
    val app: Double,
    val cores: Int
)

data class MemoryUsage(
    val total: Double,
    val app: Double,
    val appPercentage: Double
)

data class DiskUsage(
    val total: Double,
    val used: Double,
    val available: Double,
    val overall: Double,
    val app: Double
)

data class PowerStatus(
    val powerConnected: Boolean,
    val isCharging: Boolean,
    val batteryLevel: Int,
    val batteryStatus: String,
    val batteryHealth: String
)

data class UsbDevice(
    val name: String,
    val deviceId: String,
    val vendorId: String,
    val productId: String,
    val deviceClass: String
)

data class BluetoothDevice(
    val name: String,
    val address: String,
    val type: String,
    val connected: Boolean
)

data class SerialDevice(
    val name: String,
    val path: String,
    val isOpen: Boolean
)

data class NetworkConnection(
    val type: String,
    val name: String,
    val ipAddress: String,
    val gateway: String,
    val netmask: String,
    val dns: List<String>,
    val connected: Boolean
)

data class InstalledApp(
    val packageName: String,
    val appName: String,
    val versionName: String,
    val versionCode: Int,
    val installTime: Long,
    val updateTime: Long,
    val isSystemApp: Boolean
)
