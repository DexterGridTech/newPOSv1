package com.impos2.adapter.interfaces

interface IDeviceManager {
  fun getDeviceInfo(): DeviceInfo
  fun getSystemStatus(): SystemStatus
  fun getPowerStatus(): PowerStatus
  fun addPowerStatusChangeListener(listener: (PowerStatusChangeEvent) -> Unit): String
  fun removePowerStatusChangeListener(listenerId: String)
}
