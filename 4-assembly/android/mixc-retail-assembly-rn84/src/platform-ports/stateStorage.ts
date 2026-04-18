import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createNativeStateStorage} from '../turbomodules/stateStorage'

type AssemblyStorageLayer = 'state' | 'secure-state'

const APP_STORAGE_NAMESPACE = 'mixc-retail-assembly-rn84'
const STORAGE_SEPARATOR = '::'

const storageByLayer: Partial<Record<AssemblyStorageLayer, StateStoragePort>> = {}

const getNamespace = (layer: AssemblyStorageLayer): string =>
    `${APP_STORAGE_NAMESPACE}${STORAGE_SEPARATOR}${layer}`

export const createAssemblyStateStorage = (
    layer: AssemblyStorageLayer,
): StateStoragePort => {
    const existingStorage = storageByLayer[layer]
    if (existingStorage) {
        return existingStorage
    }

    const storage = createNativeStateStorage(getNamespace(layer))
    storageByLayer[layer] = storage
    return storage
}

export const resetAssemblyStateStorageForTests = (): void => {
    delete storageByLayer.state
    delete storageByLayer['secure-state']
}
