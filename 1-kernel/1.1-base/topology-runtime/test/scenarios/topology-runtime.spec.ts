import {describe, expect, it} from 'vitest'
import {
    createCommandId,
    createEnvelopeId,
    createNodeId,
    createRequestId,
    createSessionId,
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
} from '@impos2/kernel-base-contracts'
import {
    createTopologyRuntime,
} from '../../src'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {
    createTopologySyncDiff,
    createTopologySyncSummary,
} from '../../src/foundations/stateSyncPlan'

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        saved,
        storage: {
            async getItem(key: string) {
                return saved.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                saved.set(key, value)
            },
            async removeItem(key: string) {
                saved.delete(key)
            },
            async multiGet(keys: readonly string[]) {
                return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
        },
    }
}

const createDispatchEnvelope = (input: {
    requestId: string
    sessionId: string
    ownerNodeId: string
    sourceNodeId: string
    targetNodeId: string
    commandId?: string
    parentCommandId?: string
    commandName?: string
    sentAt: number
}): CommandDispatchEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        requestId: input.requestId as any,
        commandId: (input.commandId ?? createCommandId()) as any,
        parentCommandId: input.parentCommandId as any,
        ownerNodeId: input.ownerNodeId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        commandName: input.commandName ?? 'kernel.base.topology-runtime.test.remote',
        payload: {step: 'child'},
        context: {},
        sentAt: input.sentAt,
    }
}

const createEventEnvelope = (input: {
    requestId: string
    sessionId: string
    ownerNodeId: string
    sourceNodeId: string
    commandId: string
    eventType: CommandEventEnvelope['eventType']
    occurredAt: number
    result?: Record<string, unknown>
    resultPatch?: Record<string, unknown>
}): CommandEventEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        requestId: input.requestId as any,
        commandId: input.commandId as any,
        ownerNodeId: input.ownerNodeId as any,
        sourceNodeId: input.sourceNodeId as any,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        result: input.result,
        resultPatch: input.resultPatch,
    }
}

describe('topology-runtime', () => {
    it('builds owner-ledger projection from local dispatch and remote events', () => {
        const ownerNodeId = createNodeId()
        const targetNodeId = createNodeId()
        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        const childCommandId = createCommandId()
        const sessionId = createSessionId()
        const topology = createTopologyRuntime({
            localNodeId: ownerNodeId,
            localProtocolVersion: '0.0.1',
            localCapabilities: ['projection-mirror', 'command-events'],
            localRuntimeVersion: 'runtime-1',
        })

        topology.registerRootRequest({
            requestId,
            rootCommandId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            commandName: 'kernel.base.topology-runtime.test.root',
            startedAt: 1_000,
        })

        topology.registerChildDispatch(createDispatchEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            targetNodeId,
            commandId: childCommandId,
            parentCommandId: rootCommandId,
            sentAt: 1_100,
        }))

        topology.applyCommandEvent(createEventEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: targetNodeId,
            commandId: childCommandId,
            eventType: 'started',
            occurredAt: 1_200,
        }))

        topology.applyCommandEvent(createEventEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: targetNodeId,
            commandId: childCommandId,
            eventType: 'resultPatch',
            resultPatch: {progress: 50},
            occurredAt: 1_250,
        }))

        topology.applyCommandEvent(createEventEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: targetNodeId,
            commandId: childCommandId,
            eventType: 'completed',
            result: {remote: 'done'},
            occurredAt: 1_300,
        }))

        const projection = topology.getRequestProjection(requestId)
        expect(projection).toBeDefined()
        expect(projection?.status).toBe('started')
        expect(projection?.pendingCommandCount).toBe(1)
        expect(projection?.resultsByCommand[childCommandId]).toEqual({remote: 'done'})
        expect(projection?.mergedResults).toEqual({remote: 'done'})

        const compatibility = topology.evaluateCompatibility({
            peerProtocolVersion: '0.0.1',
            peerCapabilities: ['projection-mirror'],
            requiredCapabilities: ['projection-mirror'],
            peerRuntimeVersion: 'runtime-2',
        })

        expect(compatibility.level).toBe('degraded')
        expect(compatibility.reasons).toEqual(['runtimeVersion mismatch'])
        expect(compatibility.enabledCapabilities).toEqual(['projection-mirror'])
    })

    it('exports and reapplies lifecycle snapshots without losing pending request semantics', () => {
        const ownerNodeId = createNodeId()
        const remoteNodeId = createNodeId()
        const requestId = createRequestId()
        const rootCommandId = createCommandId()
        const childCommandId = createCommandId()
        const sessionId = createSessionId()

        const source = createTopologyRuntime({
            localNodeId: ownerNodeId,
            localProtocolVersion: '0.0.1',
            localCapabilities: ['projection-mirror', 'command-events'],
            localRuntimeVersion: 'runtime-1',
        })

        source.registerRootRequest({
            requestId,
            rootCommandId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            commandName: 'kernel.base.topology-runtime.test.root',
            startedAt: 10_000,
        })

        source.registerChildDispatch(createDispatchEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            targetNodeId: remoteNodeId,
            commandId: childCommandId,
            parentCommandId: rootCommandId,
            sentAt: 10_100,
        }))

        source.applyCommandEvent(createEventEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: remoteNodeId,
            commandId: childCommandId,
            eventType: 'started',
            occurredAt: 10_200,
        }))

        source.applyCommandEvent(createEventEnvelope({
            requestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: remoteNodeId,
            commandId: childCommandId,
            eventType: 'resultPatch',
            resultPatch: {step: 'running'},
            occurredAt: 10_250,
        }))

        const snapshot = source.exportRequestLifecycleSnapshot(requestId, sessionId)
        expect(snapshot).toBeDefined()
        expect(snapshot?.status).toBe('started')
        expect(snapshot?.ownerNodeId).toBe(ownerNodeId)
        expect(snapshot?.rootCommandId).toBe(rootCommandId)
        expect(snapshot?.commands).toHaveLength(2)
        expect(snapshot?.commandResults).toEqual([
            {
                commandId: childCommandId,
                result: {step: 'running'},
                error: undefined,
                completedAt: undefined,
                erroredAt: undefined,
            },
        ])

        const restored = createTopologyRuntime({
            localNodeId: ownerNodeId,
            localProtocolVersion: '0.0.1',
            localCapabilities: ['projection-mirror', 'command-events'],
            localRuntimeVersion: 'runtime-2',
        })

        restored.applyRequestLifecycleSnapshot(snapshot!)

        const restoredSnapshot = restored.exportRequestLifecycleSnapshot(requestId, sessionId)
        expect(restoredSnapshot?.ownerNodeId).toBe(ownerNodeId)
        expect(restoredSnapshot?.rootCommandId).toBe(rootCommandId)
        expect(restoredSnapshot?.commands).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    commandId: childCommandId,
                    status: 'started',
                    result: {step: 'running'},
                }),
            ]),
        )

        const restoredProjection = restored.getRequestProjection(requestId)
        expect(restoredProjection).toBeDefined()
        expect(restoredProjection?.status).toBe('started')
        expect(restoredProjection?.pendingCommandCount).toBe(2)
        expect(restoredProjection?.resultsByCommand[childCommandId]).toEqual({step: 'running'})
        expect(restoredProjection?.mergedResults).toEqual({step: 'running'})
    })

    it('stores and restores topology recovery state for slave reconnect', () => {
        const topology = createTopologyRuntime({
            localNodeId: createNodeId(),
            localProtocolVersion: '0.0.1',
        })

        topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'SECONDARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: 'ws://127.0.0.1:9999'}],
                addedAt: 1234 as any,
            },
        })

        expect(topology.getRecoveryState().masterInfo?.deviceId).toBe('master-device')

        const snapshot = topology.exportRecoveryState()
        const restored = createTopologyRuntime({
            localNodeId: createNodeId(),
            localProtocolVersion: '0.0.1',
        })

        restored.applyRecoveryState(snapshot)
        expect(restored.getRecoveryState().masterInfo?.serverAddress[0]?.address).toBe('ws://127.0.0.1:9999')
    })

    it('hydrates persisted recovery state through state storage', async () => {
        const {storage} = createMemoryStorage()
        const localNodeId = createNodeId()

        const topology = createTopologyRuntime({
            localNodeId,
            localProtocolVersion: '0.0.1',
            stateStorage: storage,
            persistenceKey: `topology:${localNodeId}`,
            allowPersistence: true,
        })

        await topology.hydrate()
        topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            masterInfo: {
                deviceId: 'master-persisted',
                serverAddress: [{address: 'ws://127.0.0.1:8877'}],
                addedAt: 9_999 as any,
            },
        })
        await topology.flushPersistence()

        const restored = createTopologyRuntime({
            localNodeId,
            localProtocolVersion: '0.0.1',
            stateStorage: storage,
            persistenceKey: `topology:${localNodeId}`,
            allowPersistence: true,
        })

        await restored.hydrate()

        expect(restored.getRecoveryState().instanceMode).toBe('SLAVE')
        expect(restored.getRecoveryState().masterInfo?.deviceId).toBe('master-persisted')
        expect(restored.getRecoveryState().masterInfo?.serverAddress[0]?.address).toBe('ws://127.0.0.1:8877')
    })

    it('builds sync summary and diff plans from slice sync descriptors', () => {
        const slices: StateRuntimeSliceDescriptor<Record<string, unknown>>[] = [
            {
                name: 'kernel.base.topology-runtime.test.master-state',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record' as const},
            },
            {
                name: 'kernel.base.topology-runtime.test.slave-state',
                persistIntent: 'never',
                syncIntent: 'slave-to-master',
                sync: {kind: 'record' as const},
            },
            {
                name: 'kernel.base.topology-runtime.test.isolated-state',
                persistIntent: 'never',
                syncIntent: 'isolated',
            },
        ]

        const state = {
            'kernel.base.topology-runtime.test.master-state': {
                A: {value: 'master-a', updatedAt: 20},
                B: {value: 'master-b', updatedAt: 30},
            },
            'kernel.base.topology-runtime.test.slave-state': {
                C: {value: 'slave-c', updatedAt: 15},
            },
            'kernel.base.topology-runtime.test.isolated-state': {
                D: {value: 'isolated', updatedAt: 99},
            },
        }

        expect(createTopologySyncSummary({
            direction: 'master-to-slave',
            slices,
            state,
        })).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.master-state',
                summary: {
                    A: {updatedAt: 20},
                    B: {updatedAt: 30},
                },
            },
        ])

        expect(createTopologySyncDiff({
            direction: 'master-to-slave',
            slices,
            state,
            remoteSummaryBySlice: {
                'kernel.base.topology-runtime.test.master-state': {
                    A: {updatedAt: 10},
                    X: {updatedAt: 50},
                },
            },
        })).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.master-state',
                diff: [
                    {
                        key: 'A',
                        value: {value: 'master-a', updatedAt: 20},
                    },
                    {
                        key: 'X',
                        value: {updatedAt: 50, tombstone: true},
                    },
                    {
                        key: 'B',
                        value: {value: 'master-b', updatedAt: 30},
                    },
                ],
            },
        ])
    })

    it('coordinates a topology sync session without binding transport', () => {
        const localNodeId = createNodeId()
        const peerNodeId = createNodeId()
        const sessionId = createSessionId()
        const topology = createTopologyRuntime({
            localNodeId,
            localProtocolVersion: '0.0.1',
        })
        const slices: StateRuntimeSliceDescriptor<Record<string, unknown>>[] = [
            {
                name: 'kernel.base.topology-runtime.test.master-state',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record' as const},
            },
        ]
        const state = {
            'kernel.base.topology-runtime.test.master-state': {
                A: {value: 'local-a', updatedAt: 20},
                B: {value: 'local-b', updatedAt: 30},
            },
        }

        const started = topology.beginSyncSession({
            sessionId,
            peerNodeId,
            direction: 'master-to-slave',
            slices,
            state,
            startedAt: 1_000 as any,
        })

        expect(started.status).toBe('awaiting-diff')
        expect(started.localSummary).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.master-state',
                summary: {
                    A: {updatedAt: 20},
                    B: {updatedAt: 30},
                },
            },
        ])

        const active = topology.acceptRemoteSyncSummary({
            sessionId,
            peerNodeId,
            direction: 'master-to-slave',
            slices,
            state,
            remoteSummaryBySlice: {
                'kernel.base.topology-runtime.test.master-state': {
                    A: {updatedAt: 10},
                    C: {updatedAt: 40},
                },
            },
            receivedAt: 1_100 as any,
        })

        expect(active.status).toBe('active')
        expect(active.lastDiff).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.master-state',
                diff: [
                    {
                        key: 'A',
                        value: {value: 'local-a', updatedAt: 20},
                    },
                    {
                        key: 'C',
                        value: {updatedAt: 40, tombstone: true},
                    },
                    {
                        key: 'B',
                        value: {value: 'local-b', updatedAt: 30},
                    },
                ],
            },
        ])
        expect(topology.getSyncSession(sessionId)?.status).toBe('active')
        topology.clearSyncSession(sessionId)
        expect(topology.getSyncSession(sessionId)).toBeUndefined()
    })

    it('tracks continuous sync diffs and only advances baseline on commit', () => {
        const topology = createTopologyRuntime({
            localNodeId: createNodeId(),
            localProtocolVersion: '0.0.1',
        })
        const sessionId = createSessionId()
        const peerNodeId = createNodeId()
        const slices: StateRuntimeSliceDescriptor<Record<string, unknown>>[] = [
            {
                name: 'kernel.base.topology-runtime.test.continuous-state',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record' as const},
            },
        ]
        const baselineState = {
            'kernel.base.topology-runtime.test.continuous-state': {
                A: {value: 'a1', updatedAt: 10},
            },
        }
        const changedState = {
            'kernel.base.topology-runtime.test.continuous-state': {
                A: {value: 'a2', updatedAt: 20},
                B: {value: 'b1', updatedAt: 30},
            },
        }

        topology.beginSyncSession({
            sessionId,
            peerNodeId,
            direction: 'master-to-slave',
            slices,
            state: baselineState,
            startedAt: 2_000 as any,
        })
        topology.activateContinuousSync({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: baselineState,
            activatedAt: 2_100 as any,
        })

        const changed = topology.collectContinuousSyncDiff({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: changedState,
        })

        expect(changed.lastDiff).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.continuous-state',
                diff: [
                    {
                        key: 'A',
                        value: {value: 'a2', updatedAt: 20},
                    },
                    {
                        key: 'B',
                        value: {value: 'b1', updatedAt: 30},
                    },
                ],
            },
        ])

        const unchangedBeforeCommit = topology.collectContinuousSyncDiff({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: changedState,
        })
        expect(unchangedBeforeCommit.lastDiff?.[0]?.diff).toHaveLength(2)

        topology.commitContinuousSync(sessionId, {
            'kernel.base.topology-runtime.test.continuous-state': {
                A: {updatedAt: 20},
                B: {updatedAt: 30},
            },
        })

        const unchangedAfterCommit = topology.collectContinuousSyncDiff({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: changedState,
        })

        expect(unchangedAfterCommit.lastDiff).toEqual([])
    })

    it('treats missing remote slice summary as empty and emits full slice diff', () => {
        const slices: StateRuntimeSliceDescriptor<Record<string, unknown>>[] = [
            {
                name: 'kernel.base.topology-runtime.test.missing-remote-slice',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record'},
            },
        ]

        const diff = createTopologySyncDiff({
            direction: 'master-to-slave',
            slices,
            state: {
                'kernel.base.topology-runtime.test.missing-remote-slice': {
                    A: {value: 'a', updatedAt: 10},
                },
            },
            remoteSummaryBySlice: {},
        })

        expect(diff).toEqual([
            {
                sliceName: 'kernel.base.topology-runtime.test.missing-remote-slice',
                diff: [
                    {
                        key: 'A',
                        value: {value: 'a', updatedAt: 10},
                    },
                ],
            },
        ])
    })

    it('maps sync session flow to transport envelopes without binding socket runtime', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const sessionId = createSessionId()
        const topology = createTopologyRuntime({
            localNodeId: masterNodeId,
            localProtocolVersion: '0.0.1',
        })
        const slices: StateRuntimeSliceDescriptor<Record<string, unknown>>[] = [
            {
                name: 'kernel.base.topology-runtime.test.transport-sync',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record' as const},
            },
        ]
        const localState = {
            'kernel.base.topology-runtime.test.transport-sync': {
                A: {value: 'master-a', updatedAt: 10},
                B: {value: 'master-b', updatedAt: 20},
            },
        }

        topology.beginSyncSession({
            sessionId,
            peerNodeId: slaveNodeId,
            direction: 'master-to-slave',
            slices,
            state: localState,
            startedAt: 3_000 as any,
        })

        const summaryEnvelope = topology.createSyncSummaryEnvelope({
            envelopeId: createEnvelopeId(),
            sessionId,
            sourceNodeId: masterNodeId,
            targetNodeId: slaveNodeId,
        })

        expect(summaryEnvelope?.summaryBySlice).toEqual({
            'kernel.base.topology-runtime.test.transport-sync': {
                A: {updatedAt: 10},
                B: {updatedAt: 20},
            },
        })

        const diffEnvelope = topology.handleSyncSummaryEnvelope({
            envelope: {
                envelopeId: createEnvelopeId(),
                sessionId,
                sourceNodeId: slaveNodeId,
                targetNodeId: masterNodeId,
                direction: 'master-to-slave',
                summaryBySlice: {
                    'kernel.base.topology-runtime.test.transport-sync': {
                        A: {updatedAt: 5},
                        C: {updatedAt: 30},
                    },
                },
                sentAt: 3_100 as any,
            },
            slices,
            state: localState,
            receivedAt: 3_100,
        })

        expect(diffEnvelope?.diffBySlice).toEqual({
            'kernel.base.topology-runtime.test.transport-sync': [
                {
                    key: 'A',
                    value: {value: 'master-a', updatedAt: 10},
                },
                {
                    key: 'C',
                    value: {updatedAt: 30, tombstone: true},
                },
                {
                    key: 'B',
                    value: {value: 'master-b', updatedAt: 20},
                },
            ],
        })

        topology.activateContinuousSync({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: localState,
            activatedAt: 3_200 as any,
        })

        const committed = topology.handleSyncCommitAckEnvelope({
            envelope: {
                envelopeId: createEnvelopeId(),
                sessionId,
                sourceNodeId: slaveNodeId,
                targetNodeId: masterNodeId,
                committedAt: 3_300 as any,
            },
            currentSummary: {
                'kernel.base.topology-runtime.test.transport-sync': {
                    A: {updatedAt: 10},
                    B: {updatedAt: 20},
                },
            },
        })

        expect(committed?.baselineSummaryBySlice).toEqual({
            'kernel.base.topology-runtime.test.transport-sync': {
                A: {updatedAt: 10},
                B: {updatedAt: 20},
            },
        })
    })

    it('lists tracked request ids for a specific peer node', () => {
        const ownerNodeId = createNodeId()
        const remoteNodeId = createNodeId()
        const otherNodeId = createNodeId()
        const sessionId = createSessionId()
        const topology = createTopologyRuntime({
            localNodeId: ownerNodeId,
            localProtocolVersion: '0.0.1',
            localCapabilities: ['projection-mirror', 'command-events'],
            localRuntimeVersion: 'runtime-1',
        })

        const peerRequestId = createRequestId()
        const peerRootCommandId = createCommandId()
        topology.registerRootRequest({
            requestId: peerRequestId,
            rootCommandId: peerRootCommandId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            commandName: 'kernel.base.topology-runtime.test.peer-root',
            startedAt: 1_000,
        })
        topology.registerChildDispatch(createDispatchEnvelope({
            requestId: peerRequestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            targetNodeId: remoteNodeId,
            parentCommandId: peerRootCommandId,
            commandName: 'kernel.base.topology-runtime.test.peer-child',
            sentAt: 1_100,
        }))

        const localRequestId = createRequestId()
        topology.registerRootRequest({
            requestId: localRequestId,
            rootCommandId: createCommandId(),
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            commandName: 'kernel.base.topology-runtime.test.local-only',
            startedAt: 2_000,
        })

        const otherPeerRequestId = createRequestId()
        const otherPeerRootCommandId = createCommandId()
        topology.registerRootRequest({
            requestId: otherPeerRequestId,
            rootCommandId: otherPeerRootCommandId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            commandName: 'kernel.base.topology-runtime.test.other-peer-root',
            startedAt: 3_000,
        })
        topology.registerChildDispatch(createDispatchEnvelope({
            requestId: otherPeerRequestId,
            sessionId,
            ownerNodeId,
            sourceNodeId: ownerNodeId,
            targetNodeId: otherNodeId,
            parentCommandId: otherPeerRootCommandId,
            commandName: 'kernel.base.topology-runtime.test.other-peer-child',
            sentAt: 3_100,
        }))

        expect(topology.listTrackedRequestIds()).toEqual([
            peerRequestId,
            localRequestId,
            otherPeerRequestId,
        ])
        expect(topology.listTrackedRequestIds({peerNodeId: remoteNodeId})).toEqual([
            peerRequestId,
        ])
        expect(topology.listTrackedRequestIds({peerNodeId: otherNodeId})).toEqual([
            otherPeerRequestId,
        ])
    })
})
