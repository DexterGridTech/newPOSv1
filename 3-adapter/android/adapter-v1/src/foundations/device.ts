import {NativeEventEmitter, NativeModules} from 'react-native'
import type {Device} from '@impos2/kernel-core-base'
import type {DeviceInfo} from '@impos2/kernel-core-base'
import type {PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base'

const {DeviceTurboModule} = NativeModules

export class DeviceAdapter implements Device {
    private emitter: NativeEventEmitter | null = null
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()
    private subscription: any = null

    private getEmitter(): NativeEventEmitter | null {
        if (!DeviceTurboModule) return null
        if (!this.emitter) this.emitter = new NativeEventEmitter(DeviceTurboModule)
        return this.emitter
    }

    async getDeviceInfo(): Promise<DeviceInfo> {
        if (!DeviceTurboModule) throw new Error('DeviceTurboModule not available')
        return DeviceTurboModule.getDeviceInfo()
    }

    async getSystemStatus(): Promise<SystemStatus> {
        if (!DeviceTurboModule) throw new Error('DeviceTurboModule not available')
        return DeviceTurboModule.getSystemStatus()
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        if (!DeviceTurboModule) return () => {}
        if (this.listeners.size === 0) {
            DeviceTurboModule.startPowerStatusListener()
            this.subscription = this.getEmitter()?.addListener('onPowerStatusChanged', (e: PowerStatusChangeEvent) => {
                this.listeners.forEach(l => l(e))
            })
        }
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) {
            this.subscription?.remove()
            this.subscription = null
            DeviceTurboModule?.stopPowerStatusListener()
        }
    }
}

export const deviceAdapter = new DeviceAdapter()
