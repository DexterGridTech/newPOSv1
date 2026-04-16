import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    getString(key: string): Promise<string | null>
    setString(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
    clearAll(): Promise<void>
    getAllKeys(): Promise<ReadonlyArray<string>>
}

export default TurboModuleRegistry.getEnforcing<Spec>('StateStorageTurboModule')
