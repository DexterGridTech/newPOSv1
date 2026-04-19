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
        platformPorts: import('@impos2/kernel-base-platform-ports').PlatformPorts
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
    const logger = deps.context.platformPorts.logger.scope({
        moduleName: 'kernel.base.topology-runtime-v2',
        subsystem: 'sync',
        component: 'TopologyIncomingHandlers',
    })
    const handleHelloAck = (
        message: Extract<TopologyRuntimeV2IncomingMessage, {type: 'node-hello-ack'}>,
    ) => {
        logger.info({
            category: 'topology.sync',
            event: 'topology-handle-hello-ack',
            message: 'handle topology hello ack',
            data: {
                localNodeId: deps.context.localNodeId,
                accepted: message.ack.accepted,
                sessionId: message.ack.sessionId ?? null,
                peerNodeId: message.ack.peerRuntime?.nodeId ?? null,
                peerRole: message.ack.peerRuntime?.role ?? null,
            },
        })
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
        if (!message.sessionId || !message.nodeId) {
            console.info('[topology-handle-resume-begin-skip]', JSON.stringify({
                nodeId: deps.context.localNodeId,
                reason: 'invalid-resume-begin-payload',
                sessionId: message.sessionId ?? null,
                sourceNodeId: message.nodeId ?? null,
            }))
            return
        }
        logger.info({
            category: 'topology.sync',
            event: 'topology-handle-resume-begin',
            message: 'handle topology resume begin',
            data: {
                localNodeId: deps.context.localNodeId,
                sessionId: message.sessionId,
                sourceNodeId: message.nodeId,
            },
        })
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
        logger.info({
            category: 'topology.sync',
            event: 'topology-sync-receive-summary',
            message: 'receive topology sync summary',
            data: {
                sessionId: message.envelope.sessionId,
                direction: message.envelope.direction,
                sliceNames: Object.keys(message.envelope.summaryBySlice),
            },
        })
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
            logger.info({
                category: 'topology.sync',
                event: 'topology-sync-reply-diff',
                message: 'reply topology sync diff to summary',
                data: {
                    sessionId: message.envelope.sessionId,
                    direction: message.envelope.direction,
                    sliceNames: Object.keys(diffBySlice),
                },
            })
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
        logger.info({
            category: 'topology.sync',
            event: 'topology-sync-receive-diff',
            message: 'receive topology sync diff',
            data: {
                sessionId: message.envelope.sessionId,
                direction: message.envelope.direction,
                sliceNames: Object.keys(message.envelope.diffBySlice),
                diffBySlice: message.envelope.diffBySlice,
            },
        })
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
        logger.info({
            category: 'topology.sync',
            event: 'topology-sync-receive-commit-ack',
            message: 'receive topology sync commit ack',
            data: {
                localNodeId: deps.context.localNodeId,
                sessionId: message.envelope.sessionId,
                direction: message.envelope.direction,
                committedAt: message.envelope.committedAt,
                sourceNodeId: message.envelope.sourceNodeId,
            },
        })
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
