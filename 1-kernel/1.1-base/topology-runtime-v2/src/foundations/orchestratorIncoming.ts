import {createEnvelopeId, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {UnknownAction} from '@reduxjs/toolkit'
import {topologyRuntimeV2StateActions} from '../features/slices'
import type {TopologyRuntimeV2IncomingMessage} from '../types'
import {buildRequestProjectionFromSnapshot, buildStateSyncCommitAckEnvelope} from './orchestratorMessages'

export interface TopologyIncomingHandlerDeps {
    setSessionId: (sessionId: string | undefined) => void
    onHelloAccepted: (message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'node-hello-ack'}>) => void
    rememberPeerRuntime: (runtime: Extract<TopologyRuntimeV2IncomingMessage, {type: 'node-hello-ack'}>['ack']['peerRuntime']) => void
    rememberPeerNodeId: (nodeId: string | undefined) => void
    sendResumeArtifacts: (input: {sessionId: string; targetNodeId?: string}) => void
    send: (message: any) => void
    dispatchConnectionPatch: (patch: Parameters<typeof topologyRuntimeV2StateActions.patchConnectionState>[0]) => void
    dispatchSyncPatch: (patch: Parameters<typeof topologyRuntimeV2StateActions.patchSyncState>[0]) => void
    scheduleReconnect: (reason?: string) => void
    clearReconnectTimer: () => void
    beginResume: () => void
    setReconnectAttempt: (next: number) => void
    getCurrentSummaryByDirection: (direction: 'master-to-slave' | 'slave-to-master') => Record<string, any>
    pendingCommitSummaryByDirection: Map<'master-to-slave' | 'slave-to-master', Record<string, any>>
    syncSessions: {
        acceptRemoteSummary: (input: any) => {lastDiff?: Array<{sliceName: string; diff: unknown}>}
        activateContinuous: (input: any) => void
        commitContinuous: (sessionId: string, direction: 'master-to-slave' | 'slave-to-master', currentSummary: Record<string, any>) => void
    }
    context: {
        localNodeId: string
        getSyncSlices: () => readonly any[]
        getState: () => Record<string, unknown>
        applyRemoteCommandEvent: (envelope: Extract<TopologyRuntimeV2IncomingMessage, {type: 'command-event'}>['envelope']) => void
        applyRequestLifecycleSnapshot: (snapshot: Extract<TopologyRuntimeV2IncomingMessage, {type: 'request-lifecycle-snapshot'}>['envelope']['snapshot']) => void
        applyStateSyncDiff: (envelope: Extract<TopologyRuntimeV2IncomingMessage, {type: 'state-sync-diff'}>['envelope']) => void
        dispatchAction: (action: UnknownAction) => void
    }
    handleRemoteDispatch: (envelope: Extract<TopologyRuntimeV2IncomingMessage, {type: 'command-dispatch'}>['envelope']) => Promise<void>
    resetContinuousDiffSignature: () => void
    maybeSendContinuousSyncDiff: () => void
}

export const createTopologyIncomingHandlers = (deps: TopologyIncomingHandlerDeps) => {
    const handleHelloAck = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'node-hello-ack'}>,
    ) => {
        deps.setSessionId(message.ack.sessionId)
        if (!message.ack.accepted || !message.ack.sessionId) {
            deps.dispatchConnectionPatch({
                connectionError: message.ack.rejectionMessage ?? message.ack.rejectionCode,
                serverConnectionStatus: 'DISCONNECTED',
            })
            deps.scheduleReconnect(message.ack.rejectionMessage ?? message.ack.rejectionCode)
            return
        }
        deps.setReconnectAttempt(0)
        deps.clearReconnectTimer()
        deps.rememberPeerRuntime(message.ack.peerRuntime)
        deps.dispatchConnectionPatch({
            serverConnectionStatus: 'CONNECTED',
            connectedAt: nowTimestampMs(),
            connectionError: undefined,
            reconnectAttempt: 0,
            lastHelloAt: message.ack.hostTime,
        })
        deps.dispatchSyncPatch({
            activeSessionId: message.ack.sessionId,
        })
        deps.beginResume()
    }

    const handleResumeBegin = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'resume-begin'}>,
    ) => {
        deps.setSessionId(message.sessionId)
        deps.rememberPeerNodeId(message.nodeId)
        deps.sendResumeArtifacts({
            sessionId: message.sessionId,
            targetNodeId: message.nodeId,
        })
    }

    const handleRequestLifecycleSnapshot = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'request-lifecycle-snapshot'}>,
    ) => {
        deps.rememberPeerNodeId(message.envelope.sourceNodeId)
        deps.context.applyRequestLifecycleSnapshot(message.envelope.snapshot)
        deps.context.dispatchAction(
            topologyRuntimeV2StateActions.replaceRequestProjection(
                buildRequestProjectionFromSnapshot({
                    snapshot: message.envelope.snapshot,
                    ownerNodeId: message.envelope.snapshot.ownerNodeId,
                }),
            ),
        )
    }

    const handleStateSyncSummary = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'state-sync-summary'}>,
    ) => {
        deps.rememberPeerNodeId(message.envelope.sourceNodeId)
        const session = deps.syncSessions.acceptRemoteSummary({
            sessionId: message.envelope.sessionId as any,
            peerNodeId: message.envelope.sourceNodeId as any,
            direction: message.envelope.direction,
            slices: deps.context.getSyncSlices(),
            state: deps.context.getState(),
            remoteSummaryBySlice: message.envelope.summaryBySlice,
            receivedAt: nowTimestampMs() as any,
        })
        const diffBySlice = Object.fromEntries(
            (session.lastDiff ?? []).map(entry => [entry.sliceName, entry.diff]),
        )
        if (Object.keys(diffBySlice).length > 0) {
            deps.send({
                type: 'state-sync-diff',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: message.envelope.sessionId,
                    sourceNodeId: message.envelope.targetNodeId,
                    targetNodeId: message.envelope.sourceNodeId,
                    direction: message.envelope.direction,
                    diffBySlice,
                    sentAt: nowTimestampMs() as any,
                },
            })
            deps.pendingCommitSummaryByDirection.set(
                message.envelope.direction,
                deps.getCurrentSummaryByDirection(message.envelope.direction),
            )
            deps.dispatchSyncPatch({
                lastDiffAppliedAt: nowTimestampMs(),
            })
            return
        }

        deps.syncSessions.commitContinuous(
            message.envelope.sessionId,
            message.envelope.direction,
            deps.getCurrentSummaryByDirection(message.envelope.direction),
        )
        deps.send({
            type: 'state-sync-commit-ack',
            envelope: buildStateSyncCommitAckEnvelope({
                sessionId: message.envelope.sessionId,
                sourceNodeId: message.envelope.targetNodeId as any,
                targetNodeId: message.envelope.sourceNodeId as any,
                direction: message.envelope.direction,
            }),
        })
    }

    const handleStateSyncDiff = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'state-sync-diff'}>,
    ) => {
        deps.rememberPeerNodeId(message.envelope.sourceNodeId)
        deps.context.applyStateSyncDiff(message.envelope)
        deps.syncSessions.activateContinuous({
            sessionId: message.envelope.sessionId as any,
            direction: message.envelope.direction,
            slices: deps.context.getSyncSlices(),
            state: deps.context.getState(),
            activatedAt: nowTimestampMs() as any,
        })
        deps.send({
            type: 'state-sync-commit-ack',
            envelope: buildStateSyncCommitAckEnvelope({
                sessionId: message.envelope.sessionId,
                sourceNodeId: message.envelope.targetNodeId as any,
                targetNodeId: message.envelope.sourceNodeId as any,
                direction: message.envelope.direction,
            }),
        })
        deps.dispatchSyncPatch({
            lastDiffAppliedAt: nowTimestampMs(),
            continuousSyncActive: true,
            lastCommitAckAt: nowTimestampMs(),
        })
    }

    const handleStateSyncCommitAck = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'state-sync-commit-ack'}>,
    ) => {
        deps.rememberPeerNodeId(message.envelope.sourceNodeId)
        deps.syncSessions.commitContinuous(
            message.envelope.sessionId,
            message.envelope.direction,
            deps.pendingCommitSummaryByDirection.get(message.envelope.direction)
                ?? deps.getCurrentSummaryByDirection(message.envelope.direction),
        )
        deps.pendingCommitSummaryByDirection.delete(message.envelope.direction)
        deps.resetContinuousDiffSignature()
        deps.dispatchSyncPatch({
            lastCommitAckAt: message.envelope.committedAt,
            continuousSyncActive: true,
            resumeStatus: 'completed',
        })
        deps.maybeSendContinuousSyncDiff()
    }

    return {
        handleHelloAck,
        handleResumeBegin,
        handleRequestLifecycleSnapshot,
        handleStateSyncSummary,
        handleStateSyncDiff,
        handleStateSyncCommitAck,
    }
}
