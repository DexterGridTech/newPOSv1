import {NativeEventEmitter} from 'react-native'
import type {Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base'
import NativeDeviceTurboModule from '../specs/NativeDeviceTurboModule'

export class DeviceAdapter implements Device {
    private emitter: NativeEventEmitter | null = null
    private listeners = new Set<(e: PowerStatusChangeEvent) => void>()
    private subscription: ReturnType<NativeEventEmitter['addListener']> | null = null

    private getEmitter(): NativeEventEmitter {
        if (!this.emitter) {
            this.emitter = new NativeEventEmitter(NativeDeviceTurboModule)
        }
        return this.emitter
    }

    async getDeviceInfo(): Promise<DeviceInfo> {
        const json = await NativeDeviceTurboModule.getDeviceInfo()
        return JSON.parse(json) as DeviceInfo
    }

    async getSystemStatus(): Promise<SystemStatus> {
        const json = await NativeDeviceTurboModule.getSystemStatus()
        return JSON.parse(json) as SystemStatus
    }

    addPowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): () => void {
        if (this.listeners.size === 0) {
            NativeDeviceTurboModule.startPowerStatusListener()
            this.subscription = this.getEmitter().addListener(
                'onPowerStatusChanged',
                (event: { data: string; timestamp: number }) => {
                    const powerStatus = JSON.parse(event.data) as PowerStatusChangeEvent
                    powerStatus.timestamp = event.timestamp
                    this.listeners.forEach(l => l(powerStatus))
                }
            )
        }
        this.listeners.add(listener)
        return () => this.removePowerStatusChangeListener(listener)
    }

    removePowerStatusChangeListener(listener: (e: PowerStatusChangeEvent) => void): void {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) {
            this.subscription?.remove()
            this.subscription = null
            NativeDeviceTurboModule.stopPowerStatusListener()
        }
    }
}

export const deviceAdapter = new DeviceAdapter()
