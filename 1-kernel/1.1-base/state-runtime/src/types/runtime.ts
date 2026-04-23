import type {EnhancedStore, StoreEnhancer} from '@reduxjs/toolkit'
import type {LoggerPort, StateStoragePort} from '@impos2/kernel-base-platform-ports'
import type {RootState} from './state'
import type {StateRuntimeSliceDescriptor} from './slice'
import type {PersistedStateRuntimeSnapshot} from './persistence'

export interface CreateStateRuntimeInput {
    runtimeName: string
    slices: readonly StateRuntimeSliceDescriptor<any>[]
    logger?: LoggerPort
    storeEnhancers?: readonly StoreEnhancer[]
    stateStorage?: StateStoragePort
    secureStateStorage?: StateStoragePort
    persistenceKey?: string
    allowPersistence?: boolean
    persistenceDebounceMs?: number
}

export interface StateRuntime {
    getStore(): EnhancedStore
    getState(): RootState
    getSlices(): readonly StateRuntimeSliceDescriptor<any>[]
    applySlicePatches(slices: Record<string, unknown>): void
    resetState(): Promise<void>
    exportPersistedState(): Promise<PersistedStateRuntimeSnapshot>
    applyPersistedState(snapshot: PersistedStateRuntimeSnapshot): void
    hydratePersistence(): Promise<void>
    flushPersistence(): Promise<PersistedStateRuntimeSnapshot>
}
