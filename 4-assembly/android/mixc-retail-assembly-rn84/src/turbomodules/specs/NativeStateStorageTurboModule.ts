import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    getString(namespace: string, key: string): Promise<string | null>
    setString(namespace: string, key: string, value: string): Promise<void>
    remove(namespace: string, key: string): Promise<void>
    clearAll(namespace: string): Promise<void>
    getAllKeys(namespace: string): Promise<ReadonlyArray<string>>
}

export default TurboModuleRegistry.getEnforcing<Spec>('StateStorageTurboModule')
