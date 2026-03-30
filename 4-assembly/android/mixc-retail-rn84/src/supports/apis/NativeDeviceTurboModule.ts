import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

// DeviceInfo 字段
export interface NativeDisplayInfo {
    id: string
    displayType: string
    refreshRate: number
    width: number
    height: number
    physicalWidth: number
    physicalHeight: number
    touchSupport: boolean
}

export interface NativeDeviceInfo {
    id: string
    manufacturer: string
    os: string
    osVersion: string
    cpu: string
    memory: string
    disk: string
    network: string
    displays: NativeDisplayInfo[]
}

// SystemStatus 字段
export interface NativeCpuUsage { app: number; cores: number }
export interface NativeMemoryUsage { total: number; app: number; appPercentage: number }
export interface NativeDiskUsage { total: number; used: number; available: number; overall: number; app: number }
export interface NativePowerStatus {
    powerConnected: boolean
    isCharging: boolean
    batteryLevel: number
    batteryStatus: string
    batteryHealth: string
}
export interface NativeUsbDevice { name: string; deviceId: string; vendorId: string; productId: string; deviceClass: string }
export interface NativeBluetoothDevice { name: string; address: string; type: string; connected: boolean }
export interface NativeSerialDevice { name: string; path: string; isOpen: boolean }
export interface NativeNetworkConnection {
    type: string; name: string; ipAddress: string
    gateway: string; netmask: string; dns: string[]; connected: boolean
}
export interface NativeInstalledApp {
    packageName: string; appName: string; versionName: string
    versionCode: number; installTime: number; updateTime: number; isSystemApp: boolean
}
export interface NativeSystemStatus {
    cpu: NativeCpuUsage
    memory: NativeMemoryUsage
    disk: NativeDiskUsage
    power: NativePowerStatus
    usbDevices: NativeUsbDevice[]
    bluetoothDevices: NativeBluetoothDevice[]
    serialDevices: NativeSerialDevice[]
    networks: NativeNetworkConnection[]
    installedApps: NativeInstalledApp[]
    updatedAt: number
}

export interface Spec extends TurboModule {
    getDeviceInfo(): Promise<Object>
    getSystemStatus(): Promise<Object>
    startPowerStatusListener(): void
    stopPowerStatusListener(): void
    addListener(eventName: string): void
    removeListeners(count: number): void
}

// Codegen 标准导出方式 - 只能有一个 TurboModuleRegistry 调用
export default TurboModuleRegistry.getEnforcing<Spec>('DeviceTurboModule');
