import type {
    ActivateTopologyContinuousSyncInput,
    AcceptTopologySyncSummaryInput,
    BeginTopologySyncSessionInput,
    CollectTopologyContinuousSyncDiffInput,
    TopologySyncSessionSnapshot,
} from '../types/sync'
import {createTopologySyncDiff, createTopologySyncSummary} from './stateSyncPlan'
import type {SyncStateSummary} from '@impos2/kernel-base-state-runtime'
import type {SyncIntent} from '@impos2/kernel-base-state-runtime'

type TopologySyncLaneDirection = Exclude<SyncIntent, 'isolated'>

const getSessionKey = (sessionId: string, direction: TopologySyncLaneDirection) =>
    `${sessionId}:${direction}`

export interface TopologySyncSessionManager {
    begin(input: BeginTopologySyncSessionInput): TopologySyncSessionSnapshot
    acceptRemoteSummary(input: AcceptTopologySyncSummaryInput): TopologySyncSessionSnapshot
    activateContinuous(input: ActivateTopologyContinuousSyncInput): TopologySyncSessionSnapshot
    collectContinuousDiff(input: CollectTopologyContinuousSyncDiffInput): TopologySyncSessionSnapshot
    commitContinuous(sessionId: string, direction: TopologySyncLaneDirection, currentSummary: Record<string, SyncStateSummary>): TopologySyncSessionSnapshot | undefined
    get(sessionId: string, direction: TopologySyncLaneDirection): TopologySyncSessionSnapshot | undefined
    clear(sessionId: string, direction?: TopologySyncLaneDirection): void
}

export const createTopologySyncSessionManager = (): TopologySyncSessionManager => {
    const sessions = new Map<string, TopologySyncSessionSnapshot>()

    return {
        begin(input) {
            const snapshot: TopologySyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: input.peerNodeId,
                direction: input.direction,
                status: 'awaiting-diff',
                startedAt: input.startedAt,
                localSummary: createTopologySyncSummary(input),
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), snapshot)
            return snapshot
        },
        acceptRemoteSummary(input) {
            const current = sessions.get(getSessionKey(input.sessionId, input.direction))
            const next: TopologySyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: input.peerNodeId,
                direction: input.direction,
                status: 'active',
                startedAt: current?.startedAt ?? input.receivedAt,
                activatedAt: input.receivedAt,
                localSummary: current?.localSummary ?? createTopologySyncSummary(input),
                lastRemoteSummary: input.remoteSummaryBySlice,
                lastDiff: createTopologySyncDiff(input),
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), next)
            return next
        },
        activateContinuous(input) {
            const current = sessions.get(getSessionKey(input.sessionId, input.direction))
            const baselineEntries = createTopologySyncSummary(input)
            const baselineSummaryBySlice = Object.fromEntries(
                baselineEntries.map(entry => [entry.sliceName, entry.summary]),
            )
            const next: TopologySyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: current?.peerNodeId ?? ('UNKNOWN' as any),
                direction: input.direction,
                status: 'continuous',
                startedAt: current?.startedAt ?? input.activatedAt,
                activatedAt: input.activatedAt,
                localSummary: current?.localSummary ?? baselineEntries,
                lastRemoteSummary: current?.lastRemoteSummary,
                lastDiff: current?.lastDiff,
                baselineSummaryBySlice,
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), next)
            return next
        },
        collectContinuousDiff(input) {
            const current = sessions.get(getSessionKey(input.sessionId, input.direction))
            const remoteSummaryBySlice = current?.baselineSummaryBySlice ?? {}
            const next: TopologySyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: current?.peerNodeId ?? ('UNKNOWN' as any),
                direction: input.direction,
                status: 'continuous',
                startedAt: current?.startedAt ?? 0,
                activatedAt: current?.activatedAt,
                localSummary: current?.localSummary ?? [],
                lastRemoteSummary: current?.lastRemoteSummary,
                lastDiff: createTopologySyncDiff({
                    ...input,
                    remoteSummaryBySlice,
                }),
                baselineSummaryBySlice: current?.baselineSummaryBySlice,
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), next)
            return next
        },
        commitContinuous(sessionId, direction, currentSummary) {
            const current = sessions.get(getSessionKey(sessionId, direction))
            if (!current) {
                return undefined
            }
            const next: TopologySyncSessionSnapshot = {
                ...current,
                status: 'continuous',
                baselineSummaryBySlice: currentSummary,
            }
            sessions.set(getSessionKey(sessionId, direction), next)
            return next
        },
        get(sessionId, direction) {
            return sessions.get(getSessionKey(sessionId, direction))
        },
        clear(sessionId, direction) {
            if (direction) {
                sessions.delete(getSessionKey(sessionId, direction))
                return
            }
            for (const key of sessions.keys()) {
                if (key.startsWith(`${sessionId}:`)) {
                    sessions.delete(key)
                }
            }
        },
    }
}
