import type {Reducer} from '@reduxjs/toolkit'
import type {
    PersistIntent,
    StateRuntimePersistenceDescriptor,
    SyncIntent,
} from './persistence'
import type {StateRuntimeSyncDescriptor} from './sync'

export interface StateRuntimeSliceDescriptor<State = unknown> {
    name: string
    reducer?: Reducer<State>
    persistIntent: PersistIntent
    syncIntent?: SyncIntent
    persistence?: readonly StateRuntimePersistenceDescriptor<State>[]
    sync?: StateRuntimeSyncDescriptor<State>
}
