import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    selectTcpBindingSnapshot,
    selectTcpTerminalId,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
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

const buildScopePriorityChain = (state: RootState) => {
    const binding = selectTcpBindingSnapshot(state)
    const terminalId = selectTcpTerminalId(state)
    const groups = [...(selectTerminalGroupMembership(state)?.groups ?? [])]
        .sort((left, right) => left.rank - right.rank)
    return [
        {scopeType: 'PLATFORM', scopeId: binding.platformId},
        {scopeType: 'PROJECT', scopeId: binding.projectId},
        {scopeType: 'BRAND', scopeId: binding.brandId},
        {scopeType: 'TENANT', scopeId: binding.tenantId},
        {scopeType: 'STORE', scopeId: binding.storeId},
        ...groups.map(group => ({scopeType: 'GROUP' as const, scopeId: group.groupId})),
        {scopeType: 'TERMINAL', scopeId: terminalId},
    ].filter((item): item is {scopeType: typeof SCOPE_PRIORITY[number]; scopeId: string} => Boolean(item.scopeId))
}

export const selectTdpSessionState = (state: RootState) =>
    state[TDP_SESSION_STATE_KEY as keyof RootState] as TdpSessionState | undefined

export const selectTdpSyncState = (state: RootState) =>
    state[TDP_SYNC_STATE_KEY as keyof RootState] as TdpSyncState | undefined

export const selectTdpProjectionState = (state: RootState) =>
    state[TDP_PROJECTION_STATE_KEY as keyof RootState] as TdpProjectionState | undefined

export const selectTdpProjectionEntriesByTopic = (
    state: RootState,
    topic: string,
): TdpProjectionEnvelope[] => {
    const projectionState = selectTdpProjectionState(state)
    return Object.values(projectionState ?? {}).filter(entry => entry.topic === topic)
}

export const selectTdpProjectionByTopicAndBucket = (
    state: RootState,
    input: {
        topic: string
        scopeType: string
        scopeId: string
        itemKey: string
    },
) => {
    return Object.values(selectTdpProjectionState(state) ?? {}).find(entry =>
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
    const entries = selectTdpProjectionEntriesByTopic(state, topic)
    const scopeChain = buildScopePriorityChain(state)
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
