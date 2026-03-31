package com.impos2.adapter.interfaces

interface IDeviceManager {
    /**
     * 获取设备信息
     */
    fun getDeviceInfo(): DeviceInfo

    /**
     * 获取系统运行状态
     */
    fun getSystemStatus(): SystemStatus

    /**
     * 添加电源状态监听器
     */
    fun addPowerStatusListener(listener: (PowerStatus) -> Unit)

    /**
     * 移除电源状态监听器
     */
    fun removePowerStatusListener(listener: (PowerStatus) -> Unit)
}
