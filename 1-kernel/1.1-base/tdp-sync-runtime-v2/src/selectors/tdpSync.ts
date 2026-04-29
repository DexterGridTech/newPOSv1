import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {
    selectTcpBindingSnapshot,
    selectTcpTerminalId,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    estimateTdpServerNow,
    isTdpProjectionExpiredForLocalDefense,
} from '../foundations/projectionExpiry'
import {
    TDP_COMMAND_INBOX_STATE_KEY,
    TDP_CONTROL_SIGNALS_STATE_KEY,
    TDP_PROJECTION_STATE_KEY,
    TDP_SESSION_STATE_KEY,
    TDP_SYNC_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TdpCommandInboxState,
    TdpControlSignalsState,
    TdpProjectionEnvelope,
    TdpProjectionState,
    TdpSessionState,
    TdpSyncState,
} from '../types'
import {selectTerminalGroupMembership} from './groupMembership'

const SCOPE_PRIORITY = ['PLATFORM', 'PROJECT', 'BRAND', 'TENANT', 'STORE', 'GROUP', 'TERMINAL'] as const
type TdpScopePriorityItem = {
    scopeType: typeof SCOPE_PRIORITY[number]
    scopeId: string
}

const selectScopePriorityChainMemo = createSelector(
    [
        selectTcpBindingSnapshot,
        selectTcpTerminalId,
        selectTerminalGroupMembership,
    ],
    (binding, terminalId, membership) => {
        const groups = [...(membership?.groups ?? [])]
            .sort((left, right) => left.rank - right.rank)
        return [
            {scopeType: 'PLATFORM', scopeId: binding.platformId},
            {scopeType: 'PROJECT', scopeId: binding.projectId},
            {scopeType: 'BRAND', scopeId: binding.brandId},
            {scopeType: 'TENANT', scopeId: binding.tenantId},
            {scopeType: 'STORE', scopeId: binding.storeId},
            ...groups.map(group => ({scopeType: 'GROUP' as const, scopeId: group.groupId})),
            {scopeType: 'TERMINAL', scopeId: terminalId},
        ].filter((item): item is TdpScopePriorityItem => Boolean(item.scopeId))
    },
)

export const selectScopePriorityChain = (state: RootState): TdpScopePriorityItem[] =>
    selectScopePriorityChainMemo(state)

export const selectTdpSessionState = (state: RootState) =>
    state[TDP_SESSION_STATE_KEY as keyof RootState] as TdpSessionState | undefined

export const selectTdpSyncState = (state: RootState) =>
    state[TDP_SYNC_STATE_KEY as keyof RootState] as TdpSyncState | undefined

export const selectTdpProjectionState = (state: RootState) =>
    state[TDP_PROJECTION_STATE_KEY as keyof RootState] as TdpProjectionState | undefined

const EMPTY_PROJECTION_ENTRIES: Record<string, TdpProjectionEnvelope> = {}

let activeProjectionEntriesCache:
    | {
        entries: Record<string, TdpProjectionEnvelope>
        serverClockOffsetMs: number | undefined
        nowBucketMs: number
        result: Record<string, TdpProjectionEnvelope>
    }
    | undefined

const getProjectionExpiryNowBucketMs = () =>
    Math.floor(Date.now() / 1000) * 1000

const filterActiveProjectionEntries = (
    entries: Record<string, TdpProjectionEnvelope>,
    estimatedServerNow: number,
) => {
    let hasExpiredEntry = false
    const filteredEntries: Record<string, TdpProjectionEnvelope> = {}
    Object.entries(entries).forEach(([key, entry]) => {
        if (isTdpProjectionExpiredForLocalDefense(entry.expiresAt, estimatedServerNow)) {
            hasExpiredEntry = true
            return
        }
        filteredEntries[key] = entry
    })

    return hasExpiredEntry
        ? filteredEntries
        : entries
}

export const selectTdpActiveProjectionEntries = (state: RootState) => {
    const entries = selectTdpProjectionState(state)?.activeEntries ?? EMPTY_PROJECTION_ENTRIES
    const serverClockOffsetMs = selectTdpSyncState(state)?.serverClockOffsetMs
    const nowBucketMs = getProjectionExpiryNowBucketMs()
    if (
        activeProjectionEntriesCache?.entries === entries
        && activeProjectionEntriesCache.serverClockOffsetMs === serverClockOffsetMs
        && activeProjectionEntriesCache.nowBucketMs === nowBucketMs
    ) {
        return activeProjectionEntriesCache.result
    }

    const result = filterActiveProjectionEntries(
        entries,
        estimateTdpServerNow(nowBucketMs, serverClockOffsetMs),
    )
    activeProjectionEntriesCache = {
        entries,
        serverClockOffsetMs,
        nowBucketMs,
        result,
    }
    return result
}

const sameProjectionEntryArray = (
    left: readonly TdpProjectionEnvelope[] | undefined,
    right: readonly TdpProjectionEnvelope[],
) =>
    left != null
    && left.length === right.length
    && left.every((entry, index) => entry === right[index])

const selectTdpActiveProjectionEntriesByTopicMemo = createSelector(
    [selectTdpActiveProjectionEntries],
    (() => {
        let previousByTopic: Record<string, TdpProjectionEnvelope[]> = {}

        return (activeEntries: Record<string, TdpProjectionEnvelope>) => {
            const nextByTopic: Record<string, TdpProjectionEnvelope[]> = {}
            Object.values(activeEntries).forEach(entry => {
                nextByTopic[entry.topic] ??= []
                nextByTopic[entry.topic]!.push(entry)
            })

            Object.entries(nextByTopic).forEach(([topic, entries]) => {
                const previousEntries = previousByTopic[topic]
                if (sameProjectionEntryArray(previousEntries, entries)) {
                    nextByTopic[topic] = previousEntries!
                }
            })

            previousByTopic = nextByTopic
            return nextByTopic
        }
    })(),
)

export const selectTdpActiveProjectionEntriesByTopic = (state: RootState) =>
    selectTdpActiveProjectionEntriesByTopicMemo(state)

export const selectTdpProjectionEntriesByTopic = (
    state: RootState,
    topic: string,
): TdpProjectionEnvelope[] =>
    [...(selectTdpActiveProjectionEntriesByTopic(state)[topic] ?? [])]

export const selectTdpProjectionByTopicAndBucket = (
    state: RootState,
    input: {
        topic: string
        scopeType: string
        scopeId: string
        itemKey: string
    },
) => {
    return Object.values(selectTdpActiveProjectionEntries(state)).find(entry =>
        entry.topic === input.topic
        && entry.scopeType === input.scopeType
        && entry.scopeId === input.scopeId
        && entry.itemKey === input.itemKey,
    )
}

export const selectTdpResolvedProjectionByTopic = (
    state: RootState,
    topic: string,
) => {
    const entries = selectTdpActiveProjectionEntriesByTopic(state)[topic] ?? EMPTY_TOPIC_ENTRIES
    const scopeChain = selectScopePriorityChain(state)
    return resolveTdpProjectionByTopic(entries, scopeChain)
}

const EMPTY_TOPIC_ENTRIES: readonly TdpProjectionEnvelope[] = []

const resolvedProjectionCache = new WeakMap<readonly TdpProjectionEnvelope[], {
    scopeChain: TdpScopePriorityItem[]
    byItemKey: Record<string, TdpProjectionEnvelope>
}>()

const resolveTdpProjectionByTopic = (
    entries: readonly TdpProjectionEnvelope[],
    scopeChain: TdpScopePriorityItem[],
) => {
    const cached = resolvedProjectionCache.get(entries)
    if (cached?.scopeChain === scopeChain) {
        return cached.byItemKey
    }

    const byItemKey: Record<string, TdpProjectionEnvelope> = {}

    entries.forEach(entry => {
        const matchIndex = scopeChain.findIndex(scope =>
            scope.scopeType === entry.scopeType && scope.scopeId === entry.scopeId,
        )
        if (matchIndex < 0) {
            return
        }
        const current = byItemKey[entry.itemKey]
        if (!current) {
            byItemKey[entry.itemKey] = entry
            return
        }
        const currentIndex = scopeChain.findIndex(scope =>
            scope.scopeType === current.scopeType && scope.scopeId === current.scopeId,
        )
        if (currentIndex < 0 || currentIndex < matchIndex) {
            byItemKey[entry.itemKey] = entry
        }
    })

    resolvedProjectionCache.set(entries, {
        scopeChain,
        byItemKey,
    })

    return byItemKey
}

export const selectTdpResolvedProjection = (
    state: RootState,
    input: {
        topic: string
        itemKey: string
    },
) => selectTdpResolvedProjectionByTopic(state, input.topic)[input.itemKey]

export const selectTdpCommandInboxState = (state: RootState) =>
    state[TDP_COMMAND_INBOX_STATE_KEY as keyof RootState] as TdpCommandInboxState | undefined

export const selectTdpControlSignalsState = (state: RootState) =>
    state[TDP_CONTROL_SIGNALS_STATE_KEY as keyof RootState] as TdpControlSignalsState | undefined
