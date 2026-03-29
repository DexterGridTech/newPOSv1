import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    executeScript(
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

// 使用 get 而非 getEnforcing，stub 阶段原生模块未注册时不崩溃
export default TurboModuleRegistry.get<Spec>('ScriptsTurboModule') as Spec
