import type { Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus } from '@impos2/kernel-core-base'

export class DeviceAdapter implements Device {
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()
    private unsubscribe: (() => void) | null = null

    async getDeviceInfo(): Promise<DeviceInfo> {
        return window.electronBridge.invoke('device:getDeviceInfo')
    }

    async getSystemStatus(): Promise<SystemStatus> {
        return window.electronBridge.invoke('device:getSystemStatus')
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        if (this.listeners.size === 0) {
            this.unsubscribe = window.electronBridge.on('device:powerStatusChanged', (e: PowerStatusChangeEvent) => {
                this.listeners.forEach(l => l(e))
            })
        }
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) {
            this.unsubscribe?.()
            this.unsubscribe = null
        }
    }
}

export const deviceAdapter = new DeviceAdapter()
