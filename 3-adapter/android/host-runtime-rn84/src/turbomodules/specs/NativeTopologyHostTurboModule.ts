import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    startTopologyHost(configJson: string): Promise<string>
    prepareTopologyLaunch(displayCount: number): Promise<string>
    stopTopologyHost(): Promise<void>
    getTopologyHostStatus(): Promise<string>
    getTopologyHostStats(): Promise<string>
    replaceTopologyFaultRules(rulesJson: string): Promise<string>
    getDiagnosticsSnapshot(): Promise<string | null>
    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('TopologyHostTurboModule')
