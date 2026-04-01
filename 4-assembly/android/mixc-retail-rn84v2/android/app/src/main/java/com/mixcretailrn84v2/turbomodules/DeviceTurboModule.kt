package com.impos2.mixcretailrn84v2.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.impos2.adapter.device.DeviceManager
import com.impos2.adapter.interfaces.BluetoothDevice
import com.impos2.adapter.interfaces.CpuUsage
import com.impos2.adapter.interfaces.DeviceInfo
import com.impos2.adapter.interfaces.DiskUsage
import com.impos2.adapter.interfaces.DisplayInfo
import com.impos2.adapter.interfaces.InstalledApp
import com.impos2.adapter.interfaces.MemoryUsage
import com.impos2.adapter.interfaces.NetworkConnection
import com.impos2.adapter.interfaces.PowerStatus
import com.impos2.adapter.interfaces.PowerStatusChangeEvent
import com.impos2.adapter.interfaces.SerialDevice
import com.impos2.adapter.interfaces.SystemStatus
import com.impos2.adapter.interfaces.UsbDevice

@ReactModule(name = DeviceTurboModule.NAME)
class DeviceTurboModule(reactContext: ReactApplicationContext) :
  NativeDeviceTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "DeviceTurboModule"
    private const val EVENT_POWER_STATUS_CHANGED = "onPowerStatusChanged"
  }

  private val deviceManager by lazy { DeviceManager.getInstance(reactApplicationContext) }
  private var nativePowerListenerId: String? = null
  private var listenerCount: Int = 0

  override fun getName(): String = NAME

  override fun getDeviceInfo(promise: Promise) {
    runCatching {
      toWritableMap(deviceManager.getDeviceInfo())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_DEVICE_INFO_ERROR", it.message, it)
    }
  }

  override fun getSystemStatus(promise: Promise) {
    runCatching {
      toWritableMap(deviceManager.getSystemStatus())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_SYSTEM_STATUS_ERROR", it.message, it)
    }
  }

  override fun addListener(eventName: String) {
    if (eventName != EVENT_POWER_STATUS_CHANGED) {
      return
    }
    listenerCount += 1
    ensurePowerListenerRegistered()
  }

  override fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
    if (listenerCount == 0) {
      unregisterPowerListenerIfNeeded()
    }
  }

  override fun invalidate() {
    unregisterPowerListenerIfNeeded()
    super.invalidate()
  }

  private fun ensurePowerListenerRegistered() {
    if (nativePowerListenerId != null) {
      return
    }
    nativePowerListenerId = deviceManager.addPowerStatusChangeListener { event ->
      sendPowerStatusChanged(event)
    }
  }

  private fun unregisterPowerListenerIfNeeded() {
    val listenerId = nativePowerListenerId ?: return
    deviceManager.removePowerStatusChangeListener(listenerId)
    nativePowerListenerId = null
  }

  private fun sendPowerStatusChanged(event: PowerStatusChangeEvent) {
    if (!reactApplicationContext.hasActiveReactInstance()) {
      return
    }
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_POWER_STATUS_CHANGED, toWritableMap(event))
  }

  private fun toWritableMap(deviceInfo: DeviceInfo): WritableMap {
    return Arguments.createMap().apply {
      putString("id", deviceInfo.id)
      putString("manufacturer", deviceInfo.manufacturer)
      putString("os", deviceInfo.os)
      putString("osVersion", deviceInfo.osVersion)
      putString("cpu", deviceInfo.cpu)
      putString("memory", deviceInfo.memory)
      putString("disk", deviceInfo.disk)
      putString("network", deviceInfo.network)
      putArray("displays", writableArray(deviceInfo.displays) { toWritableMap(it) })
    }
  }

  private fun toWritableMap(displayInfo: DisplayInfo): WritableMap {
    return Arguments.createMap().apply {
      putString("id", displayInfo.id)
      putString("displayType", displayInfo.displayType)
      putInt("refreshRate", displayInfo.refreshRate)
      putInt("width", displayInfo.width)
      putInt("height", displayInfo.height)
      putInt("physicalWidth", displayInfo.physicalWidth)
      putInt("physicalHeight", displayInfo.physicalHeight)
      putBoolean("touchSupport", displayInfo.touchSupport)
    }
  }

  private fun toWritableMap(systemStatus: SystemStatus): WritableMap {
    return Arguments.createMap().apply {
      putMap("cpu", toWritableMap(systemStatus.cpu))
      putMap("memory", toWritableMap(systemStatus.memory))
      putMap("disk", toWritableMap(systemStatus.disk))
      putMap("power", toWritableMap(systemStatus.power))
      putArray("usbDevices", writableArray(systemStatus.usbDevices) { toWritableMap(it) })
      putArray("bluetoothDevices", writableArray(systemStatus.bluetoothDevices) { toWritableMap(it) })
      putArray("serialDevices", writableArray(systemStatus.serialDevices) { toWritableMap(it) })
      putArray("networks", writableArray(systemStatus.networks) { toWritableMap(it) })
      putArray("installedApps", writableArray(systemStatus.installedApps) { toWritableMap(it) })
      putDouble("updatedAt", systemStatus.updatedAt.toDouble())
    }
  }

  private fun toWritableMap(cpuUsage: CpuUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("app", cpuUsage.app)
      putInt("cores", cpuUsage.cores)
    }
  }

  private fun toWritableMap(memoryUsage: MemoryUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("total", memoryUsage.total)
      putDouble("app", memoryUsage.app)
      putDouble("appPercentage", memoryUsage.appPercentage)
    }
  }

  private fun toWritableMap(diskUsage: DiskUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("total", diskUsage.total)
      putDouble("used", diskUsage.used)
      putDouble("available", diskUsage.available)
      putDouble("overall", diskUsage.overall)
      putDouble("app", diskUsage.app)
    }
  }

  private fun toWritableMap(powerStatus: PowerStatus): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("powerConnected", powerStatus.powerConnected)
      putBoolean("isCharging", powerStatus.isCharging)
      putInt("batteryLevel", powerStatus.batteryLevel)
      putString("batteryStatus", powerStatus.batteryStatus)
      putString("batteryHealth", powerStatus.batteryHealth)
    }
  }

  private fun toWritableMap(event: PowerStatusChangeEvent): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("powerConnected", event.powerConnected)
      putBoolean("isCharging", event.isCharging)
      putInt("batteryLevel", event.batteryLevel)
      putString("batteryStatus", event.batteryStatus)
      putString("batteryHealth", event.batteryHealth)
      putDouble("timestamp", event.timestamp.toDouble())
    }
  }

  private fun toWritableMap(usbDevice: UsbDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", usbDevice.name)
      putString("deviceId", usbDevice.deviceId)
      putString("vendorId", usbDevice.vendorId)
      putString("productId", usbDevice.productId)
      putString("deviceClass", usbDevice.deviceClass)
    }
  }

  private fun toWritableMap(bluetoothDevice: BluetoothDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", bluetoothDevice.name)
      putString("address", bluetoothDevice.address)
      putString("type", bluetoothDevice.type)
      putBoolean("connected", bluetoothDevice.connected)
    }
  }

  private fun toWritableMap(serialDevice: SerialDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", serialDevice.name)
      putString("path", serialDevice.path)
      putBoolean("isOpen", serialDevice.isOpen)
    }
  }

  private fun toWritableMap(networkConnection: NetworkConnection): WritableMap {
    return Arguments.createMap().apply {
      putString("type", networkConnection.type)
      putString("name", networkConnection.name)
      putString("ipAddress", networkConnection.ipAddress)
      putString("gateway", networkConnection.gateway)
      putString("netmask", networkConnection.netmask)
      putArray("dns", Arguments.createArray().apply {
        networkConnection.dns.forEach { pushString(it) }
      })
      putBoolean("connected", networkConnection.connected)
    }
  }

  private fun toWritableMap(installedApp: InstalledApp): WritableMap {
    return Arguments.createMap().apply {
      putString("packageName", installedApp.packageName)
      putString("appName", installedApp.appName)
      putString("versionName", installedApp.versionName)
      putInt("versionCode", installedApp.versionCode)
      putDouble("installTime", installedApp.installTime.toDouble())
      putDouble("updateTime", installedApp.updateTime.toDouble())
      putBoolean("isSystemApp", installedApp.isSystemApp)
    }
  }

  private fun <T> writableArray(items: List<T>, mapper: (T) -> WritableMap): WritableArray {
    return Arguments.createArray().apply {
      items.forEach { pushMap(mapper(it)) }
    }
  }
}
