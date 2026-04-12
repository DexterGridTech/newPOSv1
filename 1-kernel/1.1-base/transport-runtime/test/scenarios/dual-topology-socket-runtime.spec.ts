import {afterEach, describe, expect, it} from 'vitest'
import {
    createCommandId,
    createEnvelopeId,
    createNodeId,
    createRequestId,
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
    type RequestLifecycleSnapshotEnvelope,
    type StateSyncCommitAckEnvelope,
    type StateSyncDiffEnvelope,
    type StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import {createPlatformPorts, createLoggerPort} from '@impos2/kernel-base-platform-ports'
import type {StateRuntimeSliceDescriptor, SyncStateSummary} from '@impos2/kernel-base-state-runtime'
import {
    createKernelRuntime,
    selectRequestProjection,
    type KernelRuntimeModule,
} from '@impos2/kernel-base-runtime-shell'
import {createTopologyRuntime} from '@impos2/kernel-base-topology-runtime'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
    type SocketEvent,
} from '../../src'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createHello, createRuntimeInfo} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/runtimeInfo'
import {createNodeWsTransport} from '../helpers/nodeWsTransport'

const servers: Array<ReturnType<typeof createDualTopologyHostServer>> = []

const createEchoModule = (): KernelRuntimeModule => {
    return {
        moduleName: 'kernel.base.transport-runtime.test.echo-module',
        packageVersion: '0.0.1',
        install(context) {
            context.registerHandler('kernel.base.transport-runtime.test.echo', async handlerContext => {
                return {
                    payload: handlerContext.command.payload as Record<string, unknown>,
                }
            })
        },
    }
}

const createSilentLogger = (moduleName: string) => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write: () => {},
        scope: {
            moduleName,
            layer: 'kernel',
        },
    })
}

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

const createDualTopologySocketRuntime = (
    serverBaseUrl: string,
    moduleName: string,
) => {
    return createSocketRuntime({
        logger: createSilentLogger(moduleName),
        transport: createNodeWsTransport(),
        servers: [
            {
                serverName: 'dual-topology-host',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: serverBaseUrl,
                    },
                ],
            },
        ],
    })
}

const createDualTopologySocketProfile = () => {
    return defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: 'dual-topology.ws',
        serverName: 'dual-topology-host',
        pathTemplate: '/mockMasterServer/ws',
        handshake: {
            headers: typed<Record<string, string>>('dual-topology.ws.headers'),
        },
        messages: {
            incoming: typed('dual-topology.ws.incoming'),
            outgoing: typed('dual-topology.ws.outgoing'),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: 0,
        },
    })
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('transport-runtime dual-topology ws', () => {
    it('carries dual-topology remote command round-trip over socket runtime', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createSilentLogger('kernel.base.transport-runtime.test.owner-runtime'),
            }),
            modules: [createEchoModule()],
        })
        await ownerRuntime.start()

        const peerRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createSilentLogger('kernel.base.transport-runtime.test.peer-runtime'),
            }),
            modules: [createEchoModule()],
        })
        await peerRuntime.start()

        const ticket = await fetchJson<{
            success: boolean
            token: string
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId,
            }),
        })

        const masterSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.master-socket',
        )
        const slaveSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.slave-socket',
        )

        const profile = createDualTopologySocketProfile()

        masterSocketRuntime.registerProfile(profile)
        slaveSocketRuntime.registerProfile(profile)

        let sessionId: string | undefined
        const slaveDispatchEnvelopes: CommandDispatchEnvelope[] = []
        const masterEventEnvelopes: CommandEventEnvelope[] = []

        masterSocketRuntime.on<{
            type: string
            ack?: {sessionId?: string}
            envelope?: CommandEventEnvelope
        }>('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'node-hello-ack') {
                sessionId = message.ack?.sessionId
            }
            if (message.type === 'command-event' && message.envelope) {
                masterEventEnvelopes.push(message.envelope)
            }
        })

        slaveSocketRuntime.on<{
            type: string
            envelope?: CommandDispatchEnvelope
        }>('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'command-dispatch' && message.envelope) {
                slaveDispatchEnvelopes.push(message.envelope)
            }
        })

        await masterSocketRuntime.connect('dual-topology.ws')
        await slaveSocketRuntime.connect('dual-topology.ws')

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: slaveNodeId,
                deviceId: 'slave-device',
                role: 'slave',
            })),
        })

        await waitFor(() => Boolean(sessionId))

        const requestId = createRequestId()
        const rootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.transport-runtime.test.echo',
            payload: {owner: 'local-root'},
            requestId,
        })
        expect(rootResult.status).toBe('completed')

        const rootCommandId = ownerRuntime.exportRequestLifecycleSnapshot(requestId, sessionId)?.rootCommandId
        if (!rootCommandId || !sessionId) {
            throw new Error('Missing rootCommandId or sessionId')
        }

        const remoteDispatchEnvelope = ownerRuntime.createRemoteDispatchEnvelope({
            requestId,
            sessionId,
            parentCommandId: rootCommandId,
            targetNodeId: slaveNodeId,
            commandName: 'kernel.base.transport-runtime.test.echo',
            payload: {peer: 'done'},
        })

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'command-dispatch',
            envelope: remoteDispatchEnvelope,
        })

        await waitFor(() => {
            return slaveDispatchEnvelopes.some(envelope => envelope.commandId === remoteDispatchEnvelope.commandId)
        })

        const relayedDispatch = slaveDispatchEnvelopes.find(envelope => {
            return envelope.commandId === remoteDispatchEnvelope.commandId
        })
        if (!relayedDispatch) {
            throw new Error('Relayed dispatch missing on slave socket runtime')
        }

        const peerResult = await peerRuntime.handleRemoteDispatch(relayedDispatch)
        expect(peerResult.events).toHaveLength(3)

        expect(selectRequestProjection(peerRuntime.getState(), requestId)).toBeUndefined()

        peerResult.events.forEach(event => {
            slaveSocketRuntime.send('dual-topology.ws', {
                type: 'command-event',
                envelope: event,
            })
        })

        await waitFor(() => masterEventEnvelopes.length >= 3)

        const remoteEvents = masterEventEnvelopes.filter(event => {
            return event.commandId === remoteDispatchEnvelope.commandId
        })

        expect(remoteEvents.map(event => event.eventType)).toEqual(['accepted', 'started', 'completed'])

        remoteEvents.forEach(event => {
            ownerRuntime.applyRemoteCommandEvent(event)
        })

        const ownerProjection = selectRequestProjection(ownerRuntime.getState(), requestId)
        expect(ownerProjection?.status).toBe('complete')
        expect(ownerProjection?.pendingCommandCount).toBe(0)
        expect(ownerProjection?.resultsByCommand[remoteDispatchEnvelope.commandId]).toEqual({
            payload: {
                peer: 'done',
            },
        })
        expect((ownerProjection?.mergedResults.payload as {peer?: string} | undefined)?.peer).toBe('done')

        masterSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
    })

    it('carries resume snapshot barrier semantics over socket runtime', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createSilentLogger('kernel.base.transport-runtime.test.resume-owner-runtime'),
            }),
            modules: [createEchoModule()],
        })
        await ownerRuntime.start()

        const mirrorRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createSilentLogger('kernel.base.transport-runtime.test.resume-mirror-runtime'),
            }),
            modules: [],
        })
        await mirrorRuntime.start()

        const ticket = await fetchJson<{
            success: boolean
            token: string
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId,
            }),
        })

        const masterSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.resume-master-socket',
        )
        const slaveSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.resume-slave-socket',
        )

        const profile = createDualTopologySocketProfile()
        masterSocketRuntime.registerProfile(profile)
        slaveSocketRuntime.registerProfile(profile)

        let sessionId: string | undefined
        const resumedSlaveSnapshotEnvelopes: RequestLifecycleSnapshotEnvelope[] = []
        const resumedSlaveDispatchEnvelopes: CommandDispatchEnvelope[] = []

        masterSocketRuntime.on('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'node-hello-ack') {
                sessionId = message.ack?.sessionId
            }
        })

        slaveSocketRuntime.on('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'request-lifecycle-snapshot' && message.envelope) {
                resumedSlaveSnapshotEnvelopes.push(message.envelope)
            }
            if (message.type === 'command-dispatch' && message.envelope) {
                resumedSlaveDispatchEnvelopes.push(message.envelope)
            }
        })

        await masterSocketRuntime.connect('dual-topology.ws')
        await slaveSocketRuntime.connect('dual-topology.ws')

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: slaveNodeId,
                deviceId: 'slave-device',
                role: 'slave',
            })),
        })

        await waitFor(() => Boolean(sessionId))
        if (!sessionId) {
            throw new Error('Missing sessionId')
        }

        const executionRequestId = createRequestId()
        const executionResult = await ownerRuntime.execute({
            commandName: 'kernel.base.transport-runtime.test.echo',
            payload: {value: 'from-owner-runtime'},
            requestId: executionRequestId,
        })
        expect(executionResult.status).toBe('completed')

        slaveSocketRuntime.disconnect('dual-topology.ws', 'simulate-offline')

        await waitFor(() => {
            const session = server.host.hostRuntime.getSession(sessionId!)
            const slaveNode = session?.nodes[slaveNodeId]
            return Boolean(slaveNode && slaveNode.connected === false)
        })

        const queuedDispatch: CommandDispatchEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId,
            requestId: createRequestId(),
            commandId: createCommandId(),
            ownerNodeId: masterNodeId,
            sourceNodeId: masterNodeId,
            targetNodeId: slaveNodeId,
            commandName: 'kernel.base.transport-runtime.test.after-resume',
            payload: {stage: 'queued-while-offline'},
            context: {},
            sentAt: Date.now(),
        }

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'command-dispatch',
            envelope: queuedDispatch,
        })

        await slaveSocketRuntime.connect('dual-topology.ws')

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: slaveNodeId,
                deviceId: 'slave-device',
                role: 'slave',
            })),
        })

        await waitFor(() => {
            const session = server.host.hostRuntime.getSession(sessionId!)
            const slaveNode = session?.nodes[slaveNodeId]
            return Boolean(slaveNode && slaveNode.connected === true)
        })

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'resume-begin',
            sessionId,
            nodeId: slaveNodeId,
            timestamp: Date.now(),
        })

        const ownerSnapshot = ownerRuntime.exportRequestLifecycleSnapshot(executionRequestId, sessionId)
        if (!ownerSnapshot) {
            throw new Error('Owner runtime did not export request lifecycle snapshot')
        }

        const lifecycleSnapshotEnvelope: RequestLifecycleSnapshotEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId,
            requestId: executionRequestId,
            ownerNodeId: masterNodeId,
            sourceNodeId: masterNodeId,
            targetNodeId: slaveNodeId,
            snapshot: ownerSnapshot,
            sentAt: Date.now(),
        }

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'request-lifecycle-snapshot',
            envelope: lifecycleSnapshotEnvelope,
        })

        await waitFor(() => resumedSlaveSnapshotEnvelopes.length === 1)
        expect(resumedSlaveDispatchEnvelopes).toHaveLength(0)

        mirrorRuntime.applyRequestLifecycleSnapshot(resumedSlaveSnapshotEnvelopes[0].snapshot)

        const mirroredProjection = selectRequestProjection(
            mirrorRuntime.getState(),
            executionRequestId,
        )
        expect(mirroredProjection?.status).toBe('complete')
        expect(mirroredProjection?.pendingCommandCount).toBe(0)
        expect(mirroredProjection?.mergedResults).toEqual({
            payload: {
                value: 'from-owner-runtime',
            },
        })

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'resume-complete',
            sessionId,
            nodeId: slaveNodeId,
            timestamp: Date.now() + 1,
        })

        await waitFor(() => {
            return resumedSlaveDispatchEnvelopes.some(envelope => envelope.commandId === queuedDispatch.commandId)
        })

        masterSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
    })

    it('carries state sync envelopes over socket runtime and advances baseline only after commit ack', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        let sessionId: string | undefined

        const slices: StateRuntimeSliceDescriptor[] = [
            {
                name: 'kernel.base.transport-runtime.test.sync',
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
                sync: {kind: 'record'},
            },
        ]
        const baselineState = {
            'kernel.base.transport-runtime.test.sync': {
                A: {value: 'a1', updatedAt: 10},
            },
        }
        const changedState = {
            'kernel.base.transport-runtime.test.sync': {
                A: {value: 'a2', updatedAt: 20},
                B: {value: 'b1', updatedAt: 30},
            },
        }
        const changedSummary: Record<string, SyncStateSummary> = {
            'kernel.base.transport-runtime.test.sync': {
                A: {updatedAt: 20 as any},
                B: {updatedAt: 30 as any},
            },
        }

        const masterTopology = createTopologyRuntime({
            localNodeId: masterNodeId,
            localProtocolVersion: '0.0.1',
        })
        const slaveTopology = createTopologyRuntime({
            localNodeId: slaveNodeId,
            localProtocolVersion: '0.0.1',
        })

        const ticket = await fetchJson<{
            success: boolean
            token: string
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId,
            }),
        })

        const masterSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.sync-master-socket',
        )
        const slaveSocketRuntime = createDualTopologySocketRuntime(
            serverBaseUrl,
            'kernel.base.transport-runtime.test.sync-slave-socket',
        )
        const profile = createDualTopologySocketProfile()
        masterSocketRuntime.registerProfile(profile)
        slaveSocketRuntime.registerProfile(profile)

        const receivedSummaryEnvelopes: StateSyncSummaryEnvelope[] = []
        const receivedDiffEnvelopes: StateSyncDiffEnvelope[] = []
        const receivedCommitAckEnvelopes: StateSyncCommitAckEnvelope[] = []

        slaveSocketRuntime.on('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'state-sync-summary' && message.envelope) {
                receivedSummaryEnvelopes.push(message.envelope)
            }
        })

        masterSocketRuntime.on('dual-topology.ws', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (!message) {
                return
            }
            if (message.type === 'node-hello-ack') {
                sessionId = message.ack?.sessionId
            }
            if (message.type === 'state-sync-diff' && message.envelope) {
                receivedDiffEnvelopes.push(message.envelope)
            }
            if (message.type === 'state-sync-commit-ack' && message.envelope) {
                receivedCommitAckEnvelopes.push(message.envelope)
            }
        })

        await masterSocketRuntime.connect('dual-topology.ws')
        await slaveSocketRuntime.connect('dual-topology.ws')

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: slaveNodeId,
                deviceId: 'slave-device',
                role: 'slave',
            })),
        })

        await waitFor(() => Boolean(sessionId))
        if (!sessionId) {
            throw new Error('Missing sessionId')
        }

        masterTopology.beginSyncSession({
            sessionId,
            peerNodeId: slaveNodeId,
            direction: 'master-to-slave',
            slices,
            state: baselineState,
            startedAt: 1_000 as any,
        })
        slaveTopology.beginSyncSession({
            sessionId,
            peerNodeId: masterNodeId,
            direction: 'master-to-slave',
            slices,
            state: baselineState,
            startedAt: 1_000 as any,
        })

        const summaryEnvelope = masterTopology.createSyncSummaryEnvelope({
            envelopeId: createEnvelopeId(),
            sessionId,
            sourceNodeId: masterNodeId,
            targetNodeId: slaveNodeId,
            direction: 'master-to-slave',
        })
        if (!summaryEnvelope) {
            throw new Error('Missing state sync summary envelope')
        }

        masterSocketRuntime.send('dual-topology.ws', {
            type: 'state-sync-summary',
            envelope: summaryEnvelope,
        })

        await waitFor(() => receivedSummaryEnvelopes.length === 1)
        expect(receivedSummaryEnvelopes[0].summaryBySlice).toEqual(summaryEnvelope.summaryBySlice)

        const diffEnvelope = slaveTopology.handleSyncSummaryEnvelope({
            envelope: receivedSummaryEnvelopes[0],
            slices,
            state: changedState,
            receivedAt: Date.now(),
        })
        if (!diffEnvelope) {
            throw new Error('Missing state sync diff envelope')
        }

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'state-sync-diff',
            envelope: diffEnvelope,
        })

        await waitFor(() => receivedDiffEnvelopes.length === 1)
        expect(receivedDiffEnvelopes[0].diffBySlice).toEqual(diffEnvelope.diffBySlice)

        masterTopology.activateContinuousSync({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: baselineState,
            activatedAt: Date.now() as any,
        })

        const beforeAck = masterTopology.collectContinuousSyncDiff({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: changedState,
        })
        expect(beforeAck.lastDiff?.[0]?.diff).toEqual([
            {
                key: 'A',
                value: {value: 'a2', updatedAt: 20},
            },
            {
                key: 'B',
                value: {value: 'b1', updatedAt: 30},
            },
        ])

        const commitAckEnvelope: StateSyncCommitAckEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId,
            sourceNodeId: slaveNodeId,
            targetNodeId: masterNodeId,
            direction: 'master-to-slave',
            committedAt: Date.now(),
        }

        slaveSocketRuntime.send('dual-topology.ws', {
            type: 'state-sync-commit-ack',
            envelope: commitAckEnvelope,
        })

        await waitFor(() => receivedCommitAckEnvelopes.length === 1)
        const committed = masterTopology.handleSyncCommitAckEnvelope({
            envelope: receivedCommitAckEnvelopes[0],
            currentSummary: changedSummary,
        })
        expect(committed?.baselineSummaryBySlice).toEqual(changedSummary)

        const afterAck = masterTopology.collectContinuousSyncDiff({
            sessionId,
            direction: 'master-to-slave',
            slices,
            state: changedState,
        })
        expect(afterAck.lastDiff).toEqual([])

        masterSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
    })
})
