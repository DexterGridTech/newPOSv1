import type {
    ActivateTopologyContinuousSyncInput,
    AcceptTopologySyncSummaryInput,
    BeginTopologySyncSessionInput,
    CollectTopologyContinuousSyncDiffInput,
    TopologySyncSessionSnapshot,
} from '../types/sync'
import {createTopologySyncDiff, createTopologySyncSummary} from './stateSyncPlan'
import type {SyncStateSummary} from '@impos2/kernel-base-state-runtime'

export interface TopologySyncSessionManager {
    begin(input: BeginTopologySyncSessionInput): TopologySyncSessionSnapshot
    acceptRemoteSummary(input: AcceptTopologySyncSummaryInput): TopologySyncSessionSnapshot
    activateContinuous(input: ActivateTopologyContinuousSyncInput): TopologySyncSessionSnapshot
    collectContinuousDiff(input: CollectTopologyContinuousSyncDiffInput): TopologySyncSessionSnapshot
    commitContinuous(sessionId: string, currentSummary: Record<string, SyncStateSummary>): TopologySyncSessionSnapshot | undefined
    get(sessionId: string): TopologySyncSessionSnapshot | undefined
    clear(sessionId: string): void
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
            sessions.set(input.sessionId, snapshot)
            return snapshot
        },
        acceptRemoteSummary(input) {
            const current = sessions.get(input.sessionId)
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
            sessions.set(input.sessionId, next)
            return next
        },
        activateContinuous(input) {
            const current = sessions.get(input.sessionId)
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
            sessions.set(input.sessionId, next)
            return next
        },
        collectContinuousDiff(input) {
            const current = sessions.get(input.sessionId)
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
            sessions.set(input.sessionId, next)
            return next
        },
        commitContinuous(sessionId, currentSummary) {
            const current = sessions.get(sessionId)
            if (!current) {
                return undefined
            }
            const next: TopologySyncSessionSnapshot = {
                ...current,
                baselineSummaryBySlice: currentSummary,
            }
            sessions.set(sessionId, next)
            return next
        },
        get(sessionId) {
            return sessions.get(sessionId)
        },
        clear(sessionId) {
            sessions.delete(sessionId)
        },
    }
}
