import type {
    StateRuntimeSliceDescriptor,
    SyncStateDiff,
    SyncRecordState,
    SyncStateSummary,
    SyncValueEnvelope,
} from '../types'

/**
 * 设计意图：
 * 这里实现 state-runtime 的通用同步算法，只解决“谁更新得更新、墓碑如何传播、record 如何合并”。
 * 真正哪些 slice 参与同步、按什么粒度同步，仍由各 slice descriptor 声明，避免同步规则散落在业务模块里。
 */
const isSyncValueEnvelope = (value: unknown): value is SyncValueEnvelope => {
    if (!value || typeof value !== 'object') {
        return false
    }
    return typeof (value as SyncValueEnvelope).updatedAt === 'number'
}

export const createSyncStateSummary = (
    state: Record<string, unknown>,
): SyncStateSummary => {
    const summary: SyncStateSummary = {}

    for (const [key, value] of Object.entries(state)) {
        if (!isSyncValueEnvelope(value)) {
            continue
        }
        summary[key] = {
            updatedAt: value.updatedAt,
            tombstone: value.tombstone === true ? true : undefined,
        }
    }

    return summary
}

export const mergeSyncRecordState = <TValue>(
    current: SyncRecordState<TValue>,
    incoming: Partial<Record<string, SyncValueEnvelope<TValue> | undefined>>,
): SyncRecordState<TValue> => {
    const next: SyncRecordState<TValue> = {
        ...current,
    }

    for (const [key, incomingValue] of Object.entries(incoming)) {
        if (!incomingValue) {
            continue
        }

        const localValue = next[key]
        if (!localValue || localValue.updatedAt < incomingValue.updatedAt) {
            next[key] = incomingValue
        }
    }

    return next
}

export const applySliceSyncDiff = <TState extends Record<string, unknown>>(
    descriptor: Pick<StateRuntimeSliceDescriptor<TState>, 'sync'>,
    state: TState,
    diff: SyncStateDiff,
): TState => {
    if (!descriptor.sync || descriptor.sync.kind !== 'record') {
        return state
    }

    const incoming = Object.fromEntries(
        diff.map(entry => [entry.key, entry.value]),
    ) as Record<string, SyncValueEnvelope | undefined>

    if (descriptor.sync.applyEntries) {
        return descriptor.sync.applyEntries(state, incoming) as TState
    }

    const next = mergeSyncRecordState(
        state as SyncRecordState,
        incoming,
    )

    Object.keys(next).forEach(key => {
        if (next[key]?.tombstone === true) {
            delete next[key]
        }
    })

    return next as TState
}

export const createSyncTombstone = (
    updatedAt: number,
): SyncValueEnvelope<never> => ({
    updatedAt,
    tombstone: true,
})

export const createSliceSyncSummary = <TState extends Record<string, unknown>>(
    descriptor: Pick<StateRuntimeSliceDescriptor<TState>, 'sync'>,
    state: TState,
): SyncStateSummary => {
    if (!descriptor.sync || descriptor.sync.kind !== 'record') {
        return {}
    }

    const entries = descriptor.sync.getEntries?.(state) ?? state
    return createSyncStateSummary(entries as Record<string, unknown>)
}

export const createSliceSyncDiff = <TState extends Record<string, unknown>>(
    descriptor: Pick<StateRuntimeSliceDescriptor<TState>, 'sync'>,
    state: TState,
    remoteSummary: SyncStateSummary,
): SyncStateDiff => {
    if (!descriptor.sync || descriptor.sync.kind !== 'record') {
        return []
    }

    const entries = descriptor.sync.getEntries?.(state) ?? state
    const diff: SyncStateDiff = []
    const typedEntries = entries as Record<string, SyncValueEnvelope | undefined>

    for (const [key, remoteEntry] of Object.entries(remoteSummary)) {
        const localEntry = typedEntries[key]
        if (!localEntry) {
            diff.push({
                key,
                value: createSyncTombstone(remoteEntry.updatedAt),
            })
            continue
        }
        if (localEntry.updatedAt > remoteEntry.updatedAt) {
            diff.push({
                key,
                value: localEntry,
            })
        }
    }

    for (const [key, localEntry] of Object.entries(typedEntries)) {
        if (!localEntry) {
            continue
        }
        if (!remoteSummary[key]) {
            diff.push({
                key,
                value: localEntry,
            })
        }
    }

    return diff
}
