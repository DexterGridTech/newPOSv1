import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createNativeStateStorage} from '../turbomodules/stateStorage'

type AssemblyStorageLayer = 'state' | 'secure-state'

const APP_STORAGE_NAMESPACE = 'mixc-retail-assembly-rn84'
const STORAGE_SEPARATOR = '::'

export interface AssemblyStateStorageOptions {
    shouldDisablePersistence?: () => boolean
}

interface ManagedAssemblyStateStorage {
    storage: StateStoragePort
    setGate(gate: AssemblyStateStorageOptions['shouldDisablePersistence']): void
}

const storageByLayer: Partial<Record<AssemblyStorageLayer, ManagedAssemblyStateStorage>> = {}

const getNamespace = (layer: AssemblyStorageLayer): string =>
    `${APP_STORAGE_NAMESPACE}${STORAGE_SEPARATOR}${layer}`

export const createAssemblyStateStorage = (
    layer: AssemblyStorageLayer,
    options: AssemblyStateStorageOptions = {},
): StateStoragePort => {
    const existing = storageByLayer[layer]
    if (existing) {
        if (options.shouldDisablePersistence) {
            existing.setGate(options.shouldDisablePersistence)
        }
        return existing.storage
    }

    const nativeStorage = createNativeStateStorage(getNamespace(layer))
    let shouldDisablePersistence = options.shouldDisablePersistence
    const isDisabled = () => shouldDisablePersistence?.() === true
    const storage: StateStoragePort = {
        async getItem(key) {
            if (isDisabled()) {
                return null
            }
            return nativeStorage.getItem(key)
        },
        async setItem(key, value) {
            if (isDisabled()) {
                return
            }
            return nativeStorage.setItem(key, value)
        },
        async removeItem(key) {
            if (isDisabled()) {
                return
            }
            return nativeStorage.removeItem(key)
        },
        async multiGet(keys) {
            if (isDisabled()) {
                return Object.fromEntries(keys.map(key => [key, null]))
            }
            return nativeStorage.multiGet?.(keys) ?? Object.fromEntries(
                await Promise.all(keys.map(async key => [key, await nativeStorage.getItem(key)] as const)),
            )
        },
        async multiSet(entries) {
            if (isDisabled()) {
                return
            }
            if (nativeStorage.multiSet) {
                return nativeStorage.multiSet(entries)
            }
            await Promise.all(Object.entries(entries).map(([key, value]) =>
                nativeStorage.setItem(key, value),
            ))
        },
        async multiRemove(keys) {
            if (isDisabled()) {
                return
            }
            if (nativeStorage.multiRemove) {
                return nativeStorage.multiRemove(keys)
            }
            await Promise.all(keys.map(key => nativeStorage.removeItem(key)))
        },
        async getAllKeys() {
            if (isDisabled()) {
                return []
            }
            return nativeStorage.getAllKeys?.() ?? []
        },
        async clear() {
            if (isDisabled()) {
                return
            }
            return nativeStorage.clear?.()
        },
    }

    storageByLayer[layer] = {
        storage,
        setGate(gate) {
            shouldDisablePersistence = gate
        },
    }
    return storage
}

export const resetAssemblyStateStorageForTests = (): void => {
    delete storageByLayer.state
    delete storageByLayer['secure-state']
}
