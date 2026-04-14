import type {SyncStateSummary, SyncIntent} from '@impos2/kernel-base-state-runtime'
import {
    createTopologyV2SyncDiff,
    createTopologyV2SyncSummary,
} from './syncPlan'
import type {
    AcceptTopologyV2SyncSummaryInput,
    ActivateTopologyV2ContinuousSyncInput,
    BeginTopologyV2SyncSessionInput,
    CollectTopologyV2ContinuousSyncDiffInput,
    TopologyV2SyncSessionSnapshot,
} from '../types'

type TopologyV2SyncLaneDirection = Exclude<SyncIntent, 'isolated'>

const getSessionKey = (sessionId: string, direction: TopologyV2SyncLaneDirection) =>
    `${sessionId}:${direction}`

export interface TopologyV2SyncSessionManager {
    begin(input: BeginTopologyV2SyncSessionInput): TopologyV2SyncSessionSnapshot
    acceptRemoteSummary(input: AcceptTopologyV2SyncSummaryInput): TopologyV2SyncSessionSnapshot
    activateContinuous(input: ActivateTopologyV2ContinuousSyncInput): TopologyV2SyncSessionSnapshot
    collectContinuousDiff(input: CollectTopologyV2ContinuousSyncDiffInput): TopologyV2SyncSessionSnapshot
    commitContinuous(
        sessionId: string,
        direction: TopologyV2SyncLaneDirection,
        currentSummary: Record<string, SyncStateSummary>,
    ): TopologyV2SyncSessionSnapshot | undefined
    get(sessionId: string, direction: TopologyV2SyncLaneDirection): TopologyV2SyncSessionSnapshot | undefined
}

export const createTopologyV2SyncSessionManager = (): TopologyV2SyncSessionManager => {
    const sessions = new Map<string, TopologyV2SyncSessionSnapshot>()

    return {
        begin(input) {
            const snapshot: TopologyV2SyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: input.peerNodeId,
                direction: input.direction,
                status: 'awaiting-diff',
                startedAt: input.startedAt,
                localSummary: createTopologyV2SyncSummary(input),
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), snapshot)
            return snapshot
        },
        acceptRemoteSummary(input) {
            const current = sessions.get(getSessionKey(input.sessionId, input.direction))
            const next: TopologyV2SyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: input.peerNodeId,
                direction: input.direction,
                status: 'active',
                startedAt: current?.startedAt ?? input.receivedAt,
                activatedAt: input.receivedAt,
                localSummary: current?.localSummary ?? createTopologyV2SyncSummary(input),
                lastRemoteSummary: input.remoteSummaryBySlice,
                lastDiff: createTopologyV2SyncDiff(input),
            }
            sessions.set(getSessionKey(input.sessionId, input.direction), next)
            return next
        },
        activateContinuous(input) {
            const current = sessions.get(getSessionKey(input.sessionId, input.direction))
            const baselineEntries = createTopologyV2SyncSummary(input)
            const baselineSummaryBySlice = Object.fromEntries(
                baselineEntries.map(entry => [entry.sliceName, entry.summary]),
            )
            const next: TopologyV2SyncSessionSnapshot = {
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
            const next: TopologyV2SyncSessionSnapshot = {
                sessionId: input.sessionId,
                peerNodeId: current?.peerNodeId ?? ('UNKNOWN' as any),
                direction: input.direction,
                status: 'continuous',
                startedAt: current?.startedAt ?? 0,
                activatedAt: current?.activatedAt,
                localSummary: current?.localSummary ?? [],
                lastRemoteSummary: current?.lastRemoteSummary,
                lastDiff: createTopologyV2SyncDiff({
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
            const next: TopologyV2SyncSessionSnapshot = {
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
    }
}
