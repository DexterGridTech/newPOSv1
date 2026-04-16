package com.impos2.adapterv2.interfaces

/**
 * 设备信息与系统状态能力抽象。
 *
 * 上层通过它读取：
 * - 静态设备信息
 * - 当前系统状态快照
 * - 电源状态及变化事件
 */
interface IDeviceManager {
  fun getDeviceInfo(): DeviceInfo
  fun getSystemStatus(): SystemStatus
  fun getPowerStatus(): PowerStatus
  fun addPowerStatusChangeListener(listener: (PowerStatusChangeEvent) -> Unit): String
  fun removePowerStatusChangeListener(listenerId: String)
}
