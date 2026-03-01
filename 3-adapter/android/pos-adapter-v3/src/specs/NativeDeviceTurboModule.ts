import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    getDeviceInfo(): Promise<string>
    getSystemStatus(): Promise<string>
    startPowerStatusListener(): void
    stopPowerStatusListener(): void
    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceTurboModule')
