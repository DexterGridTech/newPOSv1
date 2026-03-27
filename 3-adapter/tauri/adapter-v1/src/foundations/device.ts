import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus } from '@impos2/kernel-core-base'

export class DeviceAdapter implements Device {
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()
    private unlisten: UnlistenFn | null = null

    async getDeviceInfo(): Promise<DeviceInfo> {
        return invoke<DeviceInfo>('device_get_info')
    }

    async getSystemStatus(): Promise<SystemStatus> {
        return invoke<SystemStatus>('device_get_system_status')
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        if (this.listeners.size === 0) {
            listen<PowerStatusChangeEvent>('device://power-status-changed', (event) => {
                this.listeners.forEach((l) => l(event.payload))
            }).then((fn) => {
                this.unlisten = fn
            })
        }
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) {
            this.unlisten?.()
            this.unlisten = null
        }
    }
}

export const deviceAdapter = new DeviceAdapter()
