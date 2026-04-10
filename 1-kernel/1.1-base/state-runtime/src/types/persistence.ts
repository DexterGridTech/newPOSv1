export type PersistIntent = 'never' | 'owner-only'

export type SyncIntent =
    | 'isolated'
    | 'master-to-slave'
    | 'slave-to-master'

export type PersistenceProtection = 'plain' | 'protected'

export type PersistenceFlushMode = 'immediate' | 'debounced'

export interface PersistedStateEntrySnapshot {
    key: string
    value: unknown
    protected: boolean
}

export interface PersistedStateRuntimeSnapshot {
    entries: PersistedStateEntrySnapshot[]
}

export interface StateRuntimePersistenceFieldDescriptor<State = unknown> {
    kind: 'field'
    stateKey: string
    storageKey?: string
    protection?: PersistenceProtection
    flushMode?: PersistenceFlushMode
    shouldPersist?: (value: unknown, state: State) => boolean
}

export interface StateRuntimePersistenceRecordDescriptor<
    State extends Record<string, unknown> = Record<string, unknown>,
> {
    kind: 'record'
    storageKeyPrefix?: string
    protection?: PersistenceProtection
    flushMode?: PersistenceFlushMode
    getEntries?: (state: State) => Record<string, unknown>
    shouldPersistEntry?: (
        entryKey: string,
        value: unknown,
        state: State,
    ) => boolean
}

export type StateRuntimePersistenceDescriptor<State = unknown> =
    | StateRuntimePersistenceFieldDescriptor<State>
    | StateRuntimePersistenceRecordDescriptor<any>
