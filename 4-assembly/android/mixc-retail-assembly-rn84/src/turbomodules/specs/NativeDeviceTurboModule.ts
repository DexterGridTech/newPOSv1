import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    getDeviceInfo(): Promise<Record<string, unknown>>
    getSystemStatus(): Promise<Record<string, unknown>>
    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceTurboModule')
