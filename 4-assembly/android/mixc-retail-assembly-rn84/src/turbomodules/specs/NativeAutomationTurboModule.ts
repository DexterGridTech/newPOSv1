import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    startAutomationHost(configJson: string): Promise<string>
    stopAutomationHost(): Promise<void>
    getAutomationHostStatus(): Promise<string>
    resolveAutomationMessage(callId: string, responseJson: string): Promise<void>
    rejectAutomationMessage(callId: string, errorMessage: string): Promise<void>
    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('AutomationTurboModule')

