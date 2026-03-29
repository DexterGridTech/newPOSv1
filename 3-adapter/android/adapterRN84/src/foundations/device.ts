import type {Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base'

// Stub: DeviceTurboModule 尚未实现，返回 mock 数据
export class DeviceAdapter implements Device {
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()

    async getDeviceInfo(): Promise<DeviceInfo> {
        return {
            deviceId: 'stub-device-id',
            model: 'Stub Device',
            manufacturer: 'Stub',
            osVersion: 'Android 0',
            appVersion: '0.0.0',
        } as DeviceInfo
    }

    async getSystemStatus(): Promise<SystemStatus> {
        return {
            batteryLevel: 100,
            isCharging: true,
            memoryUsage: 0,
            cpuUsage: 0,
        } as SystemStatus
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
    }
}

export const deviceAdapter = new DeviceAdapter()
