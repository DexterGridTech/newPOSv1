import {NativeEventEmitter} from 'react-native'
import type {Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base'
import NativeDeviceTurboModule from '../supports/apis/NativeDeviceTurboModule'

export class DeviceAdapter implements Device {
    private emitter: NativeEventEmitter | null = null
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()
    private subscription: ReturnType<NativeEventEmitter['addListener']> | null = null

    private get native() {
        return NativeDeviceTurboModule
    }

    private getEmitter(): NativeEventEmitter | null {
        const m = this.native
        if (!m) return null
        if (!this.emitter) this.emitter = new NativeEventEmitter(m as any)
        return this.emitter
    }

    async getDeviceInfo(): Promise<DeviceInfo> {
        const m = this.native
        if (!m) throw new Error('DeviceTurboModule not available')
        return m.getDeviceInfo() as Promise<DeviceInfo>
    }

    async getSystemStatus(): Promise<SystemStatus> {
        const m = this.native
        if (!m) throw new Error('DeviceTurboModule not available')
        return m.getSystemStatus() as Promise<SystemStatus>
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        const m = this.native
        if (!m) return () => {}
        if (this.listeners.size === 0) {
            m.startPowerStatusListener()
            this.subscription = this.getEmitter()?.addListener(
                'onPowerStatusChanged',
                (e: PowerStatusChangeEvent) => this.listeners.forEach(l => l(e)),
            ) ?? null
        }
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) {
            this.subscription?.remove()
            this.subscription = null
            this.native?.stopPowerStatusListener()
        }
    }
}

export const deviceAdapter = new DeviceAdapter()
