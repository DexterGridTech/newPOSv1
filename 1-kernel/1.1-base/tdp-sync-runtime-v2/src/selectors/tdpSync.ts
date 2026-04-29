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
    TDP_TOPIC_ACTIVITY_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TdpCommandInboxState,
    TdpControlSignalsState,
    TdpOperationsFinding,
    TdpOperationsSnapshot,
    TdpOperationsTopicSnapshot,
    TdpProjectionEnvelope,
    TdpProjectionState,
    TdpSessionState,
    TdpSyncState,
    TdpTopicActivityState,
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

export const selectTdpTopicActivityState = (state: RootState) =>
    state[TDP_TOPIC_ACTIVITY_STATE_KEY as keyof RootState] as TdpTopicActivityState | undefined

const toUniqueSortedTopics = (
    ...topicGroups: Array<readonly string[] | undefined>
) => Array.from(new Set(
    topicGroups
        .flatMap(topics => [...(topics ?? [])])
        .filter(topic => topic.length > 0),
)).sort()

const maxDefinedNumber = (...values: Array<number | undefined>) =>
    values.reduce<number | undefined>((current, value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return current
        }
        if (current == null || value > current) {
            return value
        }
        return current
    }, undefined)

const positiveLag = (
    high: number | undefined,
    low: number | undefined,
) => Math.max(0, (high ?? 0) - (low ?? 0))

const sumRecentWindowCounts = (
    activity: TdpTopicActivityState['topics'][string] | undefined,
    kind: 'receivedCount' | 'appliedCount',
) => (activity?.recentWindows ?? [])
    .reduce((total, window) => total + window[kind], 0)

const perMinuteRate = (
    count: number,
    windowSizeMs: number,
    windowCount: number,
) => {
    const durationMs = Math.max(1, windowSizeMs * Math.max(1, windowCount))
    return Math.round((count / durationMs) * 60_000 * 100) / 100
}

const computeSnapshotProgress = (sync?: TdpSyncState) => {
    const totalItems = sync?.applyingSnapshotTotalItems
    const appliedItems = sync?.applyingSnapshotAppliedItems
    if (typeof totalItems !== 'number' || totalItems <= 0) {
        return undefined
    }
    const safeAppliedItems = Math.max(0, Math.min(appliedItems ?? 0, totalItems))
    return {
        appliedItems: safeAppliedItems,
        totalItems,
        percent: Math.round((safeAppliedItems / totalItems) * 100),
    }
}

const createTopicSnapshot = (
    topic: string,
    input: {
        requestedTopics: ReadonlySet<string>
        acceptedTopics: ReadonlySet<string>
        rejectedTopics: ReadonlySet<string>
        requiredMissingTopics: ReadonlySet<string>
        activeEntries: readonly TdpProjectionEnvelope[]
        stagedEntries: readonly TdpProjectionEnvelope[]
        estimatedServerNow: number
    },
): Omit<TdpOperationsTopicSnapshot, 'activity'> => {
    const allEntries = [...input.activeEntries, ...input.stagedEntries]
    const requested = input.requestedTopics.has(topic)
    const accepted = input.acceptedTopics.has(topic)
    const rejected = input.rejectedTopics.has(topic)
    const requiredMissing = input.requiredMissingTopics.has(topic)
    const localEntryCount = input.activeEntries.length
    const stagedEntryCount = input.stagedEntries.length
    const scopeCounts: Record<string, number> = {}
    const lifecycleCounts: Record<string, number> = {}
    let maxRevision: number | undefined
    let lastOccurredAt: string | undefined
    let expiredEntryCount = 0

    allEntries.forEach(entry => {
        scopeCounts[entry.scopeType] = (scopeCounts[entry.scopeType] ?? 0) + 1
        const lifecycle = entry.lifecycle ?? 'persistent'
        lifecycleCounts[lifecycle] = (lifecycleCounts[lifecycle] ?? 0) + 1
        maxRevision = maxDefinedNumber(maxRevision, entry.revision)
        if (!lastOccurredAt || entry.occurredAt > lastOccurredAt) {
            lastOccurredAt = entry.occurredAt
        }
        if (isTdpProjectionExpiredForLocalDefense(entry.expiresAt, input.estimatedServerNow)) {
            expiredEntryCount += 1
        }
    })

    const localResidual = !accepted && localEntryCount > 0
    const status = requiredMissing
        ? 'required-missing'
        : rejected
            ? 'rejected'
            : accepted
                ? 'accepted'
                : localResidual
                    ? 'local-residual'
                    : requested
                        ? 'local-only'
                        : 'inactive'

    return {
        topic,
        requested,
        accepted,
        rejected,
        requiredMissing,
        localResidual,
        status,
        localEntryCount,
        stagedEntryCount,
        maxRevision,
        lastOccurredAt,
        scopeCounts,
        lifecycleCounts,
        expiredEntryCount,
    }
}

const createFinding = (
    key: string,
    tone: TdpOperationsFinding['tone'],
    title: string,
    detail: string,
): TdpOperationsFinding => ({
    key,
    tone,
    title,
    detail,
})

const selectTdpOperationsSnapshotMemo = createSelector(
    [
        selectTdpSessionState,
        selectTdpSyncState,
        selectTdpProjectionState,
        selectTdpCommandInboxState,
        selectTdpControlSignalsState,
        selectTdpTopicActivityState,
    ],
    (session, sync, projection, commandInbox, controlSignals, topicActivity): TdpOperationsSnapshot => {
        const sessionStatus = session?.status ?? 'IDLE'
        const acceptedTopics = session?.subscription?.acceptedTopics ?? sync?.lastAcceptedSubscribedTopics ?? []
        const requestedTopics = sync?.lastRequestedSubscribedTopics ?? sync?.activeSubscribedTopics ?? acceptedTopics
        const rejectedTopics = session?.subscription?.rejectedTopics ?? []
        const requiredMissingTopics = session?.subscription?.requiredMissingTopics ?? []
        const activeTopics = sync?.activeSubscribedTopics ?? acceptedTopics
        const acceptedHash = session?.subscription?.hash ?? sync?.lastAcceptedSubscriptionHash
        const requestedHash = sync?.lastRequestedSubscriptionHash
        const activeHash = sync?.activeSubscriptionHash
        const localHashMismatch = Boolean(
            requestedHash
            && acceptedHash
            && requestedHash !== acceptedHash,
        ) || Boolean(
            activeHash
            && acceptedHash
            && activeHash !== acceptedHash,
        )
        const activeEntries = Object.values(projection?.activeEntries ?? {})
        const stagedEntries = Object.values(projection?.stagedEntries ?? {})
        const activeEntriesByTopic = activeEntries.reduce<Record<string, TdpProjectionEnvelope[]>>((result, entry) => {
            result[entry.topic] ??= []
            result[entry.topic]!.push(entry)
            return result
        }, {})
        const stagedEntriesByTopic = stagedEntries.reduce<Record<string, TdpProjectionEnvelope[]>>((result, entry) => {
            result[entry.topic] ??= []
            result[entry.topic]!.push(entry)
            return result
        }, {})
        const allTopics = toUniqueSortedTopics(
            requestedTopics,
            acceptedTopics,
            rejectedTopics,
            requiredMissingTopics,
            activeEntries.map(entry => entry.topic),
            stagedEntries.map(entry => entry.topic),
            Object.keys(topicActivity?.topics ?? {}),
        )
        const estimatedServerNow = estimateTdpServerNow(Date.now(), sync?.serverClockOffsetMs)
        const requestedTopicSet = new Set(requestedTopics)
        const acceptedTopicSet = new Set(acceptedTopics)
        const rejectedTopicSet = new Set(rejectedTopics)
        const requiredMissingTopicSet = new Set(requiredMissingTopics)
        const activityWindowSizeMs = topicActivity?.windowSizeMs ?? 60_000
        const topics = allTopics.map(topic => {
            const activity = topicActivity?.topics[topic]
            const windowCount = activity?.recentWindows.length ?? 0
            const recentReceivedCount = sumRecentWindowCounts(activity, 'receivedCount')
            const recentAppliedCount = sumRecentWindowCounts(activity, 'appliedCount')
            return {
                ...createTopicSnapshot(topic, {
                    requestedTopics: requestedTopicSet,
                    acceptedTopics: acceptedTopicSet,
                    rejectedTopics: rejectedTopicSet,
                    requiredMissingTopics: requiredMissingTopicSet,
                    activeEntries: activeEntriesByTopic[topic] ?? [],
                    stagedEntries: stagedEntriesByTopic[topic] ?? [],
                    estimatedServerNow,
                }),
                activity: {
                    receivedCount: activity?.receivedCount ?? 0,
                    appliedCount: activity?.appliedCount ?? 0,
                    snapshotAppliedCount: activity?.snapshotAppliedCount ?? 0,
                    changesAppliedCount: activity?.changesAppliedCount ?? 0,
                    realtimeAppliedCount: activity?.realtimeAppliedCount ?? 0,
                    lastReceivedAt: activity?.lastReceivedAt,
                    lastAppliedAt: activity?.lastAppliedAt,
                    lastSource: activity?.lastSource,
                    recentReceivedPerMinute: perMinuteRate(recentReceivedCount, activityWindowSizeMs, windowCount),
                    recentAppliedPerMinute: perMinuteRate(recentAppliedCount, activityWindowSizeMs, windowCount),
                },
            }
        })
        const expiredEntryCount = topics.reduce((count, topic) => count + topic.expiredEntryCount, 0)
        const totalReceivedCount = Object.values(topicActivity?.topics ?? {})
            .reduce((count, activity) => count + activity.receivedCount, 0)
        const totalAppliedCount = Object.values(topicActivity?.topics ?? {})
            .reduce((count, activity) => count + activity.appliedCount, 0)
        const lastReceivedAt = maxDefinedNumber(
            ...Object.values(topicActivity?.topics ?? {}).map(activity => activity.lastReceivedAt),
        )
        const lastAppliedAt = maxDefinedNumber(
            ...Object.values(topicActivity?.topics ?? {}).map(activity => activity.lastAppliedAt),
        )
        const hottestTopics = [...topics]
            .sort((left, right) =>
                right.activity.recentAppliedPerMinute - left.activity.recentAppliedPerMinute
                || right.activity.recentReceivedPerMinute - left.activity.recentReceivedPerMinute
                || left.topic.localeCompare(right.topic),
            )
            .filter(topic =>
                topic.activity.recentAppliedPerMinute > 0
                || topic.activity.recentReceivedPerMinute > 0,
            )
            .slice(0, 5)
            .map(topic => ({
                topic: topic.topic,
                recentAppliedPerMinute: topic.activity.recentAppliedPerMinute,
                recentReceivedPerMinute: topic.activity.recentReceivedPerMinute,
            }))
        const highWatermarkStale = sessionStatus !== 'READY'
        const watermarkLag = session?.highWatermark == null
            ? undefined
            : positiveLag(session.highWatermark, sync?.lastAppliedCursor)
        const deliveredLag = positiveLag(sync?.lastCursor, sync?.lastDeliveredCursor)
        const ackLag = positiveLag(sync?.lastDeliveredCursor, sync?.lastAckedCursor)
        const applyLag = positiveLag(sync?.lastAckedCursor, sync?.lastAppliedCursor)
        const orderedCommandIds = commandInbox?.orderedIds ?? []
        const latestCommand = orderedCommandIds.length === 0
            ? undefined
            : commandInbox?.itemsById[orderedCommandIds[orderedCommandIds.length - 1]!]
        const findings: TdpOperationsFinding[] = []

        if (sessionStatus === 'ERROR' || sessionStatus === 'REHOME_REQUIRED') {
            findings.push(createFinding(
                'session-error',
                'error',
                'TDP 会话不可用',
                `当前状态为 ${sessionStatus}，需要查看事件与告警。`,
            ))
        } else if (sessionStatus !== 'READY') {
            findings.push(createFinding(
                'session-not-ready',
                'warn',
                'TDP 会话未就绪',
                `当前状态为 ${sessionStatus}，游标水位可能是断连前快照。`,
            ))
        }
        if (requiredMissingTopics.length > 0) {
            findings.push(createFinding(
                'required-missing-topics',
                'error',
                '存在 required topic 缺失',
                requiredMissingTopics.join(', '),
            ))
        }
        if (rejectedTopics.length > 0) {
            findings.push(createFinding(
                'rejected-topics',
                'warn',
                '存在被拒绝 topic',
                rejectedTopics.join(', '),
            ))
        }
        if (localHashMismatch) {
            findings.push(createFinding(
                'local-hash-mismatch',
                'warn',
                '本地订阅 Hash 不一致',
                'requested / active / accepted subscription hash 不一致，需要确认是否处于订阅切换或旧 session。',
            ))
        }
        if (!highWatermarkStale && watermarkLag != null && watermarkLag > 0) {
            findings.push(createFinding(
                'watermark-lag',
                'warn',
                '游标仍有延迟',
                `lastAppliedCursor 落后 highWatermark ${watermarkLag} 个 revision。`,
            ))
        }
        if (ackLag > 0) {
            findings.push(createFinding(
                'ack-lag',
                'neutral',
                'ACK 差值待观察',
                `lastDeliveredCursor 比 lastAckedCursor 高 ${ackLag}。Phase 1 仅展示差值，不直接判错。`,
            ))
        }
        if (applyLag > 0) {
            findings.push(createFinding(
                'apply-lag',
                'neutral',
                'Apply 差值待观察',
                `lastAckedCursor 比 lastAppliedCursor 高 ${applyLag}。Phase 1 仅展示差值，不直接判错。`,
            ))
        }
        if (expiredEntryCount > 0) {
            findings.push(createFinding(
                'expired-local-projections',
                'warn',
                '存在过期本地 projection',
                `${expiredEntryCount} 条 projection 已过期但仍在本地 active/staged entries 中。`,
            ))
        }
        if (controlSignals?.lastProtocolError) {
            findings.push(createFinding(
                'protocol-error',
                'error',
                '最近发生协议错误',
                controlSignals.lastProtocolError.message,
            ))
        }
        if (findings.length === 0) {
            findings.push(createFinding(
                'healthy-local',
                'ok',
                '本地 TDP 状态未发现明显异常',
                'Phase 1 仅覆盖本地和握手视角；服务端策略对比需要服务端诊断增强。',
            ))
        }

        return {
            session: {
                status: sessionStatus,
                sessionId: session?.sessionId,
                nodeId: session?.nodeId,
                nodeState: session?.nodeState,
                syncMode: session?.syncMode,
                highWatermark: session?.highWatermark,
                connectedAt: session?.connectedAt,
                lastPongAt: session?.lastPongAt,
                reconnectAttempt: session?.reconnectAttempt,
                disconnectReason: session?.disconnectReason,
                highWatermarkStale,
            },
            sync: {
                snapshotStatus: sync?.snapshotStatus ?? 'idle',
                changesStatus: sync?.changesStatus ?? 'idle',
                lastCursor: sync?.lastCursor,
                lastDeliveredCursor: sync?.lastDeliveredCursor,
                lastAckedCursor: sync?.lastAckedCursor,
                lastAppliedCursor: sync?.lastAppliedCursor,
                activeSubscriptionHash: sync?.activeSubscriptionHash,
                lastRequestedSubscriptionHash: sync?.lastRequestedSubscriptionHash,
                lastAcceptedSubscriptionHash: sync?.lastAcceptedSubscriptionHash,
                serverClockOffsetMs: sync?.serverClockOffsetMs,
                applyingSnapshotId: sync?.applyingSnapshotId,
                applyingSnapshotTotalItems: sync?.applyingSnapshotTotalItems,
                applyingSnapshotAppliedItems: sync?.applyingSnapshotAppliedItems,
                lastExpiredProjectionCleanupAt: sync?.lastExpiredProjectionCleanupAt,
            },
            subscription: {
                mode: session?.subscription?.mode,
                hash: session?.subscription?.hash,
                requestedTopics: [...requestedTopics],
                acceptedTopics: [...acceptedTopics],
                rejectedTopics: [...rejectedTopics],
                requiredMissingTopics: [...requiredMissingTopics],
                activeTopics: [...activeTopics],
                requestedHash,
                acceptedHash,
                localHashMismatch,
            },
            pipeline: {
                deliveredLag,
                ackLag,
                applyLag,
                watermarkLag,
                canJudgeWatermarkLag: !highWatermarkStale && watermarkLag != null,
                snapshotProgress: computeSnapshotProgress(sync),
            },
            projection: {
                activeBufferId: projection?.activeBufferId ?? 'active',
                stagedBufferId: projection?.stagedBufferId,
                activeEntryCount: activeEntries.length,
                stagedEntryCount: stagedEntries.length,
                expiredEntryCount,
                topicCount: topics.length,
            },
            activity: {
                windowSizeMs: activityWindowSizeMs,
                totalReceivedCount,
                totalAppliedCount,
                lastReceivedAt,
                lastAppliedAt,
                hottestTopics,
            },
            commandInbox: {
                count: orderedCommandIds.length,
                latestTopic: latestCommand?.topic,
                latestReceivedAt: latestCommand?.receivedAt,
            },
            controlSignals,
            topics,
            findings,
        }
    },
)

export const selectTdpOperationsSnapshot = (state: RootState): TdpOperationsSnapshot =>
    selectTdpOperationsSnapshotMemo(state)
