import type {TimestampMs} from '@impos2/kernel-base-contracts'

export type StateScopeAxis = 'instanceMode' | 'workspace' | 'displayMode'

export interface StateScopeDescriptor {
    axis: StateScopeAxis
    value: string
}

export interface SyncValueEnvelope<TValue = unknown> {
    value?: TValue
    updatedAt: TimestampMs
    tombstone?: boolean
}

export type SyncRecordState<TValue = unknown> = Record<string, SyncValueEnvelope<TValue>>

export interface SyncStateSummaryEntry {
    updatedAt: TimestampMs
    tombstone?: boolean
}

export type SyncStateSummary = Record<string, SyncStateSummaryEntry>

export interface StateRuntimeSyncRecordDescriptor<
    State extends Record<string, unknown> = Record<string, unknown>,
> {
    kind: 'record'
    getEntries?: (state: State) => Record<string, SyncValueEnvelope | undefined>
    applyEntries?: (
        state: State,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ) => State
}

export type StateRuntimeSyncDescriptor<State = unknown> =
    State extends Record<string, unknown>
        ? StateRuntimeSyncRecordDescriptor<State>
        : never

export interface SyncStateDiffEntry {
    key: string
    value: SyncValueEnvelope
}

export type SyncStateDiff = SyncStateDiffEntry[]
