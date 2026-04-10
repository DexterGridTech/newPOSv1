import type {
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
    CompatibilityDecision,
    RequestId,
    RequestProjection,
} from '@impos2/kernel-base-contracts'
import type {TopologyRecoveryState} from '../types/state'
import {createOwnerLedger} from './ownerLedger'
import {buildRequestProjection} from './projectionBuilder'
import {evaluateCompatibility} from './compatibility'
import type {
    CreateTopologyRuntimeInput,
    TopologyRuntime,
    CompatibilityEvaluationInput,
} from '../types/runtime'
import {createTopologyRecoveryState} from './state'
import {createTopologySyncSessionManager} from './stateSyncSession'

export const createTopologyRuntime = (
    input: CreateTopologyRuntimeInput,
): TopologyRuntime => {
    const ledger = createOwnerLedger()
    const syncSessions = createTopologySyncSessionManager()
    const recoveryStateListeners = new Set<(state: TopologyRecoveryState) => void>()
    const recoveryLogger = input.logger?.scope({
        subsystem: 'topology-recovery-state',
    })
    const recoveryState = createTopologyRecoveryState({
        logger: recoveryLogger,
        stateStorage: input.stateStorage,
        secureStateStorage: input.secureStateStorage,
        persistenceKey: input.persistenceKey,
        allowPersistence: input.allowPersistence,
    })

    input.logger?.info({
        category: 'runtime.load',
        event: 'topology-runtime-created',
        message: 'load topology-runtime',
        data: {
            localNodeId: input.localNodeId,
            localProtocolVersion: input.localProtocolVersion ?? '0.0.1',
            localCapabilities: input.localCapabilities ?? [],
        },
    })

    const emitRecoveryState = () => {
        const state = recoveryState.getState()
        recoveryStateListeners.forEach(listener => listener(state))
    }

    return {
        async hydrate() {
            await recoveryState.hydrate()
            emitRecoveryState()
        },
        async flushPersistence() {
            await recoveryState.flush()
        },
        subscribeRecoveryState(listener) {
            recoveryStateListeners.add(listener)
            listener(recoveryState.getState())

            return () => {
                recoveryStateListeners.delete(listener)
            }
        },
        beginSyncSession(syncInput) {
            return syncSessions.begin(syncInput)
        },
        acceptRemoteSyncSummary(syncInput) {
            return syncSessions.acceptRemoteSummary(syncInput)
        },
        activateContinuousSync(syncInput) {
            return syncSessions.activateContinuous(syncInput)
        },
        collectContinuousSyncDiff(syncInput) {
            return syncSessions.collectContinuousDiff(syncInput)
        },
        commitContinuousSync(sessionId, currentSummary) {
            return syncSessions.commitContinuous(sessionId, currentSummary)
        },
        createSyncSummaryEnvelope(syncInput) {
            const session = syncSessions.get(syncInput.sessionId)
            if (!session) {
                return undefined
            }
            return {
                envelopeId: syncInput.envelopeId,
                sessionId: syncInput.sessionId,
                sourceNodeId: syncInput.sourceNodeId,
                targetNodeId: syncInput.targetNodeId,
                direction: session.direction,
                summaryBySlice: Object.fromEntries(
                    session.localSummary.map(entry => [entry.sliceName, entry.summary]),
                ),
                sentAt: Date.now() as any,
            } satisfies StateSyncSummaryEnvelope
        },
        handleSyncSummaryEnvelope(syncInput) {
            const session = syncSessions.acceptRemoteSummary({
                sessionId: syncInput.envelope.sessionId,
                peerNodeId: syncInput.envelope.sourceNodeId,
                direction: syncInput.envelope.direction,
                slices: syncInput.slices,
                state: syncInput.state,
                remoteSummaryBySlice: syncInput.envelope.summaryBySlice,
                receivedAt: syncInput.receivedAt as any,
            })
            return {
                envelopeId: `${syncInput.envelope.envelopeId}.diff` as any,
                sessionId: syncInput.envelope.sessionId,
                sourceNodeId: syncInput.envelope.targetNodeId,
                targetNodeId: syncInput.envelope.sourceNodeId,
                direction: syncInput.envelope.direction,
                diffBySlice: Object.fromEntries(
                    (session.lastDiff ?? []).map(entry => [entry.sliceName, entry.diff]),
                ),
                sentAt: syncInput.receivedAt as any,
            } satisfies StateSyncDiffEnvelope
        },
        handleSyncCommitAckEnvelope(syncInput) {
            return syncSessions.commitContinuous(
                syncInput.envelope.sessionId,
                syncInput.currentSummary,
            )
        },
        getSyncSession(sessionId) {
            return syncSessions.get(sessionId)
        },
        clearSyncSession(sessionId) {
            syncSessions.clear(sessionId)
        },
        registerRootRequest(inputRecord) {
            ledger.registerRootRequest(inputRecord)
        },
        registerChildDispatch(envelope) {
            ledger.registerChildDispatch(envelope)
        },
        applyCommandEvent(envelope) {
            ledger.applyCommandEvent(envelope)
        },
        exportRequestLifecycleSnapshot(requestId: RequestId, sessionId) {
            return ledger.exportRequestLifecycleSnapshot(requestId, sessionId)
        },
        applyRequestLifecycleSnapshot(snapshot) {
            ledger.applyRequestLifecycleSnapshot(snapshot)
        },
        listTrackedRequestIds(input) {
            return ledger.listRequestIds(input)
        },
        hasTrackedCommand(requestId: RequestId, commandId) {
            return ledger.hasTrackedCommand(requestId, commandId)
        },
        getRequestProjection(requestId: RequestId): RequestProjection | undefined {
            const record = ledger.getRequestRecord(requestId)
            return record ? buildRequestProjection(record) : undefined
        },
        getRecoveryState() {
            return recoveryState.getState()
        },
        updateRecoveryState(patch) {
            recoveryState.updateState(patch)
            emitRecoveryState()
        },
        exportRecoveryState() {
            return recoveryState.getState()
        },
        applyRecoveryState(state) {
            recoveryState.replaceState(state)
            emitRecoveryState()
        },
        evaluateCompatibility(evaluationInput: CompatibilityEvaluationInput): CompatibilityDecision {
            return evaluateCompatibility({
                localProtocolVersion: evaluationInput.localProtocolVersion ?? input.localProtocolVersion ?? '0.0.1',
                peerProtocolVersion: evaluationInput.peerProtocolVersion,
                localCapabilities: evaluationInput.localCapabilities ?? input.localCapabilities ?? [],
                peerCapabilities: evaluationInput.peerCapabilities,
                requiredCapabilities: evaluationInput.requiredCapabilities,
                localRuntimeVersion: evaluationInput.localRuntimeVersion ?? input.localRuntimeVersion,
                peerRuntimeVersion: evaluationInput.peerRuntimeVersion,
            })
        },
    }
}
