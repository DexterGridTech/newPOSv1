import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    executeScript(
        executionId: string,
        script: string,
        paramsJson: string,
        globalsJson: string,
        nativeFuncNames: ReadonlyArray<string>,
        timeout: number,
    ): Promise<string>

    resolveNativeCall(callId: string, resultJson: string): Promise<void>
    rejectNativeCall(callId: string, errorMessage: string): Promise<void>

    getStats(): Promise<Object>
    clearStats(): Promise<void>

    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('ScriptsTurboModule')
