import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    executeScript(
        script: string,
        paramsJson: string,
        globalsJson: string,
        nativeFuncNames: string[],
        timeout: number
    ): Promise<string>

    getStats(): Promise<{
        totalExecutions: number
        cacheHits: number
        cacheMisses: number
        cacheHitRate: number
    }>

    clearCache(): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeScriptsTurboModule')
