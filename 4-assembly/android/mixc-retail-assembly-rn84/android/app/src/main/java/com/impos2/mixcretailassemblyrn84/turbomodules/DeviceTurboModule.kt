package com.impos2.mixcretailassemblyrn84.turbomodules

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.impos2.adapterv2.device.DeviceManager
import com.impos2.adapterv2.interfaces.BluetoothDevice
import com.impos2.adapterv2.interfaces.CpuUsage
import com.impos2.adapterv2.interfaces.DeviceInfo
import com.impos2.adapterv2.interfaces.DiskUsage
import com.impos2.adapterv2.interfaces.DisplayInfo
import com.impos2.adapterv2.interfaces.InstalledApp
import com.impos2.adapterv2.interfaces.MemoryUsage
import com.impos2.adapterv2.interfaces.NetworkConnection
import com.impos2.adapterv2.interfaces.PowerStatus
import com.impos2.adapterv2.interfaces.SerialDevice
import com.impos2.adapterv2.interfaces.SystemStatus
import com.impos2.adapterv2.interfaces.UsbDevice

/**
 * Device TurboModule。
 *
 * 负责把 adapterPure 的设备信息和系统状态能力桥接给 JS。它不做业务判断，只负责：
 * - 调用 DeviceManager；
 * - 把强类型对象转换成 JS 可读结构；
 * - 通过 Promise 把结果返回给上层。
 */
@ReactModule(name = DeviceTurboModule.NAME)
class DeviceTurboModule(reactContext: ReactApplicationContext) :
  NativeDeviceTurboModuleSpec(reactContext) {

  companion object {
    const val NAME = "DeviceTurboModule"
  }

  /**
   * 底层设备能力管理器。
   */
  private val deviceManager by lazy { DeviceManager.getInstance(reactApplicationContext) }

  override fun getName(): String = NAME

  /**
   * 返回设备基础信息。
   */
  override fun getDeviceInfo(promise: Promise) {
    runCatching {
      toWritableMap(deviceManager.getDeviceInfo())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_DEVICE_INFO_ERROR", it.message, it)
    }
  }

  /**
   * 返回设备系统状态。
   */
  override fun getSystemStatus(promise: Promise) {
    runCatching {
      toWritableMap(deviceManager.getSystemStatus())
    }.onSuccess {
      promise.resolve(it)
    }.onFailure {
      promise.reject("GET_SYSTEM_STATUS_ERROR", it.message, it)
    }
  }

  override fun addListener(eventName: String) = Unit

  override fun removeListeners(count: Double) = Unit

  /**
   * 把 DeviceInfo 转成 WritableMap。
   */
  private fun toWritableMap(info: DeviceInfo): WritableMap {
    return Arguments.createMap().apply {
      putString("id", info.id)
      putString("manufacturer", info.manufacturer)
      putString("os", info.os)
      putString("osVersion", info.osVersion)
      putString("cpu", info.cpu)
      putString("memory", info.memory)
      putString("disk", info.disk)
      putString("network", info.network)
      putArray("displays", Arguments.createArray().apply {
        info.displays.forEach { pushMap(toWritableMap(it)) }
      })
    }
  }

  /**
   * 把 DisplayInfo 转成 WritableMap。
   */
  private fun toWritableMap(display: DisplayInfo): WritableMap {
    return Arguments.createMap().apply {
      putString("id", display.id)
      putString("displayType", display.displayType)
      putInt("refreshRate", display.refreshRate)
      putInt("width", display.width)
      putInt("height", display.height)
      putInt("physicalWidth", display.physicalWidth)
      putInt("physicalHeight", display.physicalHeight)
      putBoolean("touchSupport", display.touchSupport)
    }
  }

  /**
   * 把 SystemStatus 转成 WritableMap。
   */
  private fun toWritableMap(status: SystemStatus): WritableMap {
    return Arguments.createMap().apply {
      putMap("cpu", toWritableMap(status.cpu))
      putMap("memory", toWritableMap(status.memory))
      putMap("disk", toWritableMap(status.disk))
      putMap("power", toWritableMap(status.power))
      putArray("usbDevices", toWritableArray(status.usbDevices.map { toWritableMap(it) }))
      putArray("bluetoothDevices", toWritableArray(status.bluetoothDevices.map { toWritableMap(it) }))
      putArray("serialDevices", toWritableArray(status.serialDevices.map { toWritableMap(it) }))
      putArray("networks", toWritableArray(status.networks.map { toWritableMap(it) }))
      putArray("installedApps", toWritableArray(status.installedApps.map { toWritableMap(it) }))
      putDouble("updatedAt", status.updatedAt.toDouble())
    }
  }

  private fun toWritableMap(cpu: CpuUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("app", cpu.app)
      putInt("cores", cpu.cores)
    }
  }

  private fun toWritableMap(memory: MemoryUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("total", memory.total)
      putDouble("app", memory.app)
      putDouble("appPercentage", memory.appPercentage)
    }
  }

  private fun toWritableMap(disk: DiskUsage): WritableMap {
    return Arguments.createMap().apply {
      putDouble("total", disk.total)
      putDouble("used", disk.used)
      putDouble("available", disk.available)
      putDouble("overall", disk.overall)
      putDouble("app", disk.app)
    }
  }

  private fun toWritableMap(power: PowerStatus): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("powerConnected", power.powerConnected)
      putBoolean("isCharging", power.isCharging)
      putInt("batteryLevel", power.batteryLevel)
      putString("batteryStatus", power.batteryStatus)
      putString("batteryHealth", power.batteryHealth)
    }
  }

  private fun toWritableMap(device: UsbDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", device.name)
      putString("deviceId", device.deviceId)
      putString("vendorId", device.vendorId)
      putString("productId", device.productId)
      putString("deviceClass", device.deviceClass)
    }
  }

  private fun toWritableMap(device: BluetoothDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", device.name)
      putString("address", device.address)
      putString("type", device.type)
      putBoolean("connected", device.connected)
    }
  }

  private fun toWritableMap(device: SerialDevice): WritableMap {
    return Arguments.createMap().apply {
      putString("name", device.name)
      putString("path", device.path)
      putBoolean("isOpen", device.isOpen)
    }
  }

  private fun toWritableMap(network: NetworkConnection): WritableMap {
    return Arguments.createMap().apply {
      putString("type", network.type)
      putString("name", network.name)
      putString("ipAddress", network.ipAddress)
      putString("gateway", network.gateway)
      putString("netmask", network.netmask)
      putArray("dns", toWritableArray(network.dns))
      putBoolean("connected", network.connected)
    }
  }

  private fun toWritableMap(app: InstalledApp): WritableMap {
    return Arguments.createMap().apply {
      putString("packageName", app.packageName)
      putString("appName", app.appName)
      putString("versionName", app.versionName)
      putInt("versionCode", app.versionCode)
      putDouble("installTime", app.installTime.toDouble())
      putDouble("updateTime", app.updateTime.toDouble())
      putBoolean("isSystemApp", app.isSystemApp)
    }
  }

  /**
   * 把字符串列表或对象列表统一转成 WritableArray。
   */
  private fun toWritableArray(items: List<*>): WritableArray {
    return Arguments.createArray().apply {
      items.forEach { item ->
        when (item) {
          null -> pushNull()
          is String -> pushString(item)
          is Int -> pushInt(item)
          is Double -> pushDouble(item)
          is Float -> pushDouble(item.toDouble())
          is Long -> pushDouble(item.toDouble())
          is Boolean -> pushBoolean(item)
          is WritableMap -> pushMap(item)
          else -> pushString(item.toString())
        }
      }
    }
  }
}
