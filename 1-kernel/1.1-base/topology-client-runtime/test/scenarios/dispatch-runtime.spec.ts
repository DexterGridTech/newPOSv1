import {describe, expect, it} from 'vitest'
import {
    createEnvelopeId,
    createNodeId,
    createRequestId,
    createSessionId,
    type CommandEventEnvelope,
    type RequestLifecycleSnapshotEnvelope,
} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime, selectRequestProjection, type KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
    type SocketEvent,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTopologyClientRuntimeModule,
    selectTopologyClientConnection,
    selectTopologyClientSync,
    topologyClientCommandNames,
} from '../../src'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {
    createBlockingEchoModule,
    createEchoModule,
    createHello,
    createRuntimeInfo,
    createSyncValueModule,
    installTopologyClientServerCleanup,
    topologyClientTestServers,
    waitFor,
} from './helpers'

installTopologyClientServerCleanup()

describe('topology-client-runtime dispatch and resume', () => {
    it('restores request projection through resume snapshot over assembly injected socket adapter', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.resume.master-socket',
                    layer: 'kernel',
                },
            }),
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

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.resume.slave-socket',
                    layer: 'kernel',
                },
            }),
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

        const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
            name: 'dual-topology.ws.resume',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.resume.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.resume.incoming'),
                outgoing: typed('dual-topology.ws.resume.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        masterSocketRuntime.registerProfile(profile)
        slaveSocketRuntime.registerProfile(profile)
        await masterSocketRuntime.connect('dual-topology.ws.resume')

        let sessionId: string | undefined
        masterSocketRuntime.on('dual-topology.ws.resume', 'message', event => {
            const message = (event as {message?: any}).message
            if (message?.type === 'node-hello-ack') {
                sessionId = message.ack?.sessionId
            }
        })

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.resume.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createEchoModule()],
        })
        await ownerRuntime.start()

        const requestId = createRequestId()
        const ownerResult = await ownerRuntime.execute({
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {from: 'owner'},
            requestId,
        })
        expect(ownerResult.status).toBe('completed')

        masterSocketRuntime.send('dual-topology.ws.resume', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.resume.client-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.resume',
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: slaveNodeId,
                                deviceId: 'slave-device',
                                role: 'slave',
                            }))
                        },
                        getResumeSnapshotRequestIds() {
                            return [requestId]
                        },
                    },
                }),
            ],
        })

        slaveRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        })

        await slaveRuntime.start()

        await waitFor(() => Boolean(sessionId))
        await waitFor(() => {
            return selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        })

        const snapshot = ownerRuntime.exportRequestLifecycleSnapshot(requestId, sessionId as any)
        if (!snapshot || !sessionId) {
            throw new Error('Owner runtime did not export request lifecycle snapshot')
        }

        const snapshotEnvelope: RequestLifecycleSnapshotEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: sessionId as any,
            requestId,
            ownerNodeId: masterNodeId,
            sourceNodeId: masterNodeId,
            targetNodeId: slaveNodeId,
            snapshot,
            sentAt: Date.now() as any,
        }

        masterSocketRuntime.send('dual-topology.ws.resume', {
            type: 'request-lifecycle-snapshot',
            envelope: snapshotEnvelope,
        })

        await waitFor(() => {
            return selectRequestProjection(slaveRuntime.getState(), requestId)?.status === 'complete'
        })

        const projection = selectRequestProjection(slaveRuntime.getState(), requestId)
        expect(projection?.status).toBe('complete')
        expect(projection?.pendingCommandCount).toBe(0)
        expect(projection?.mergedResults).toEqual({
            payload: {
                from: 'owner',
            },
        })

        masterSocketRuntime.disconnect('dual-topology.ws.resume', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.resume', 'test-complete')
    })

    it('streams remote command started lifecycle back to owner before remote command completes', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.round-trip.master-socket',
                    layer: 'kernel',
                },
            }),
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

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.round-trip.slave-socket',
                    layer: 'kernel',
                },
            }),
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

        const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
            name: 'dual-topology.ws.round-trip',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.round-trip.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.round-trip.incoming'),
                outgoing: typed('dual-topology.ws.round-trip.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.round-trip.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createEchoModule()],
        })
        await ownerRuntime.start()

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.round-trip.client-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createBlockingEchoModule({
                    releaseExecution: new Promise(resolve => setTimeout(resolve, 150)),
                }),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.round-trip',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: slaveNodeId,
                                deviceId: 'slave-device',
                                role: 'slave',
                            }))
                        },
                    },
                }),
            ],
        })

        slaveRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        })

        const masterCommandEvents: CommandEventEnvelope[] = []
        masterSocketRuntime.registerProfile(profile)
        masterSocketRuntime.on('dual-topology.ws.round-trip', 'message', event => {
            const message = (event as SocketEvent<any> & {message?: any}).message
            if (message?.type === 'command-event' && message.envelope) {
                masterCommandEvents.push(message.envelope)
                ownerRuntime.applyRemoteCommandEvent(message.envelope)
            }
        })
        await masterSocketRuntime.connect('dual-topology.ws.round-trip')
        masterSocketRuntime.send('dual-topology.ws.round-trip', {
            type: 'node-hello',
            hello: createHello(ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        await slaveRuntime.start()

        await waitFor(() => {
            return selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        })

        const requestId = createRequestId()
        const rootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {owner: 'root'},
            requestId,
        })
        expect(rootResult.status).toBe('completed')

        const sessionId = selectTopologyClientSync(slaveRuntime.getState())?.activeSessionId
        const rootCommandId = ownerRuntime.exportRequestLifecycleSnapshot(requestId, sessionId as any)?.rootCommandId
        if (!sessionId || !rootCommandId) {
            throw new Error('Missing sessionId or rootCommandId for remote dispatch round-trip')
        }

        const remoteDispatchEnvelope = ownerRuntime.createRemoteDispatchEnvelope({
            requestId,
            sessionId: sessionId as any,
            parentCommandId: rootCommandId,
            targetNodeId: slaveNodeId,
            commandName: 'kernel.base.topology-client-runtime.test.blocking-echo',
            payload: {peer: 'done'},
        })

        masterSocketRuntime.send('dual-topology.ws.round-trip', {
            type: 'command-dispatch',
            envelope: remoteDispatchEnvelope,
        })

        await waitFor(() => {
            const projection = selectRequestProjection(ownerRuntime.getState(), requestId)
            return projection?.status === 'started' && projection.pendingCommandCount === 1
        })

        await waitFor(() => {
            return masterCommandEvents
                .filter(event => event.commandId === remoteDispatchEnvelope.commandId)
                .some(event => event.eventType === 'started')
        })

        const startedEventTypes = masterCommandEvents
            .filter(event => event.commandId === remoteDispatchEnvelope.commandId)
            .map(event => event.eventType)
        const startedProjection = selectRequestProjection(ownerRuntime.getState(), requestId)

        expect(startedEventTypes).toContain('accepted')
        expect(startedEventTypes).toContain('started')
        expect(startedEventTypes).not.toContain('completed')
        expect(startedProjection?.status).toBe('started')
        expect(startedProjection?.pendingCommandCount).toBe(1)
        expect(startedProjection?.resultsByCommand[remoteDispatchEnvelope.commandId]).toBeUndefined()

        await waitFor(() => {
            return selectRequestProjection(ownerRuntime.getState(), requestId)?.status === 'complete'
        })

        const finalProjection = selectRequestProjection(ownerRuntime.getState(), requestId)
        expect(finalProjection?.status).toBe('complete')
        expect(finalProjection?.pendingCommandCount).toBe(0)
        expect(finalProjection?.resultsByCommand[remoteDispatchEnvelope.commandId]).toEqual({
            payload: {
                peer: 'done',
            },
        })
        expect(masterCommandEvents
            .filter(event => event.commandId === remoteDispatchEnvelope.commandId)
            .map(event => event.eventType),
        ).toEqual(['accepted', 'started', 'completed'])

        masterSocketRuntime.disconnect('dual-topology.ws.round-trip', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.round-trip', 'test-complete')
    })

    it('dispatches remote command through public topology-client command and returns after started barrier', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.public-command.master-socket',
                    layer: 'kernel',
                },
            }),
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

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.public-command.slave-socket',
                    layer: 'kernel',
                },
            }),
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

        const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
            name: 'dual-topology.ws.public-command',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.public-command.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.public-command.incoming'),
                outgoing: typed('dual-topology.ws.public-command.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.public-command.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createEchoModule(),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: masterSocketRuntime,
                                profileName: 'dual-topology.ws.public-command',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: masterNodeId,
                                deviceId: 'master-device',
                                role: 'master',
                            }))
                        },
                    },
                }),
            ],
        })

        ownerRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            enableSlave: true,
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.public-command.client-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createBlockingEchoModule({
                    releaseExecution: new Promise(resolve => setTimeout(resolve, 150)),
                }),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.public-command',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: slaveNodeId,
                                deviceId: 'slave-device',
                                role: 'slave',
                            }))
                        },
                    },
                }),
            ],
        })

        slaveRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        })

        await ownerRuntime.start()
        await slaveRuntime.start()

        await waitFor(() => {
            return selectTopologyClientConnection(ownerRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        })

        const rootRequestId = createRequestId()
        const rootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {owner: 'root'},
            requestId: rootRequestId,
        })
        expect(rootResult.status).toBe('completed')

        const sessionId = selectTopologyClientSync(ownerRuntime.getState())?.activeSessionId
        const rootCommandId = ownerRuntime.exportRequestLifecycleSnapshot(rootRequestId, sessionId as any)?.rootCommandId
        if (!sessionId || !rootCommandId) {
            throw new Error('Missing owner topology session for public dispatch command')
        }

        const dispatchResult = await ownerRuntime.execute({
            commandName: topologyClientCommandNames.dispatchRemoteCommand,
            payload: {
                requestId: rootRequestId,
                parentCommandId: rootCommandId,
                targetNodeId: slaveNodeId,
                commandName: 'kernel.base.topology-client-runtime.test.blocking-echo',
                payload: {peer: 'done'},
            },
        })

        expect(dispatchResult.status).toBe('completed')
        expect(dispatchResult.result).toMatchObject({
            requestId: rootRequestId,
            sessionId,
            targetNodeId: slaveNodeId,
        })

        const dispatchCommandId = (dispatchResult.result as {commandId?: string} | undefined)?.commandId
        if (!dispatchCommandId) {
            throw new Error('Missing remote commandId from dispatchRemoteCommand result')
        }

        const startedProjection = selectRequestProjection(ownerRuntime.getState(), rootRequestId)
        expect(startedProjection?.status).toBe('started')
        expect(startedProjection?.pendingCommandCount).toBe(1)
        expect(startedProjection?.resultsByCommand[dispatchCommandId]).toBeUndefined()

        await waitFor(() => {
            return selectRequestProjection(ownerRuntime.getState(), rootRequestId)?.status === 'complete'
        })

        const finalProjection = selectRequestProjection(ownerRuntime.getState(), rootRequestId)
        expect(finalProjection?.status).toBe('complete')
        expect(finalProjection?.pendingCommandCount).toBe(0)
        expect(finalProjection?.resultsByCommand[dispatchCommandId]).toEqual({
            payload: {
                peer: 'done',
            },
        })

        masterSocketRuntime.disconnect('dual-topology.ws.public-command', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.public-command', 'test-complete')
    })

    it('automatically resumes owner tracked request snapshots for the current peer without manual request list', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const unrelatedNodeId = createNodeId()

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

        const masterSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.auto-resume.master-socket',
                    layer: 'kernel',
                },
            }),
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

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.auto-resume.slave-socket',
                    layer: 'kernel',
                },
            }),
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

        const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
            name: 'dual-topology.ws.auto-resume',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.auto-resume.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.auto-resume.incoming'),
                outgoing: typed('dual-topology.ws.auto-resume.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const ownerRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.auto-resume.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createEchoModule(),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: masterSocketRuntime,
                                profileName: 'dual-topology.ws.auto-resume',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: masterNodeId,
                                deviceId: 'master-device',
                                role: 'master',
                            }))
                        },
                    },
                }),
            ],
        })

        ownerRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            enableSlave: true,
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.auto-resume.client-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.auto-resume',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: slaveNodeId,
                                deviceId: 'slave-device',
                                role: 'slave',
                            }))
                        },
                    },
                }),
            ],
        })

        slaveRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        })

        await ownerRuntime.start()

        const remoteRequestId = createRequestId()
        const rootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {owner: 'root'},
            requestId: remoteRequestId,
        })
        expect(rootResult.status).toBe('completed')

        const initialSessionId = createSessionId()
        const rootCommandId = ownerRuntime.exportRequestLifecycleSnapshot(remoteRequestId, initialSessionId)?.rootCommandId
        if (!rootCommandId) {
            throw new Error('Missing root commandId for auto resume test')
        }

        const remoteDispatchEnvelope = ownerRuntime.createRemoteDispatchEnvelope({
            requestId: remoteRequestId,
            sessionId: initialSessionId,
            parentCommandId: rootCommandId,
            targetNodeId: slaveNodeId,
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {peer: 'done'},
        })
        ownerRuntime.applyRemoteCommandEvent({
            envelopeId: createEnvelopeId(),
            sessionId: initialSessionId,
            requestId: remoteRequestId,
            commandId: remoteDispatchEnvelope.commandId,
            ownerNodeId: masterNodeId,
            sourceNodeId: slaveNodeId,
            eventType: 'started',
            occurredAt: Date.now() as any,
        })

        const unrelatedRequestId = createRequestId()
        const unrelatedRootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {owner: 'unrelated'},
            requestId: unrelatedRequestId,
        })
        expect(unrelatedRootResult.status).toBe('completed')
        const unrelatedRootCommandId = ownerRuntime.exportRequestLifecycleSnapshot(unrelatedRequestId)?.rootCommandId
        if (!unrelatedRootCommandId) {
            throw new Error('Missing unrelated root commandId for auto resume test')
        }
        ownerRuntime.createRemoteDispatchEnvelope({
            requestId: unrelatedRequestId,
            sessionId: initialSessionId,
            parentCommandId: unrelatedRootCommandId,
            targetNodeId: unrelatedNodeId,
            commandName: 'kernel.base.topology-client-runtime.test.echo',
            payload: {peer: 'other'},
        })

        await slaveRuntime.start()

        await waitFor(() => {
            return selectTopologyClientConnection(ownerRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        })

        await waitFor(() => {
            const projection = selectRequestProjection(slaveRuntime.getState(), remoteRequestId)
            return projection?.status === 'started' && projection.pendingCommandCount === 1
        })

        expect(selectRequestProjection(slaveRuntime.getState(), remoteRequestId)?.mergedResults).toEqual({
            payload: {
                owner: 'root',
            },
        })
        expect(selectRequestProjection(slaveRuntime.getState(), unrelatedRequestId)).toBeUndefined()

        masterSocketRuntime.disconnect('dual-topology.ws.auto-resume', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.auto-resume', 'test-complete')
    })

    it('applies master-to-slave state sync diff through real dual-topology host flow', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const serverBaseUrl = `http://${addressInfo.host}:${addressInfo.port}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const syncSliceName = 'kernel.base.topology-client-runtime.test.sync-state'
        const syncCommandName = 'kernel.base.topology-client-runtime.test.sync-state.put'

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

        const masterSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.state-sync.master-socket',
                    layer: 'kernel',
                },
            }),
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

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.state-sync.slave-socket',
                    layer: 'kernel',
                },
            }),
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

        const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
            name: 'dual-topology.ws.state-sync',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.state-sync.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.state-sync.incoming'),
                outgoing: typed('dual-topology.ws.state-sync.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const masterRuntime = createKernelRuntime({
            localNodeId: masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.state-sync.master-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createSyncValueModule({
                    sliceName: syncSliceName,
                    commandName: syncCommandName,
                }),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: masterSocketRuntime,
                                profileName: 'dual-topology.ws.state-sync',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: masterNodeId,
                                deviceId: 'master-device',
                                role: 'master',
                            }))
                        },
                    },
                }),
            ],
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.state-sync.slave-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createSyncValueModule({
                    sliceName: syncSliceName,
                    commandName: syncCommandName,
                }),
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.state-sync',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.token, createRuntimeInfo({
                                nodeId: slaveNodeId,
                                deviceId: 'slave-device',
                                role: 'slave',
                            }))
                        },
                    },
                }),
            ],
        })

        await masterRuntime.start()
        await slaveRuntime.start()

        expect((await masterRuntime.execute({
            commandName: topologyClientCommandNames.setEnableSlave,
            payload: {enableSlave: true},
        })).status).toBe('completed')
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.setInstanceMode,
            payload: {instanceMode: 'SLAVE'},
        })).status).toBe('completed')
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.setDisplayMode,
            payload: {displayMode: 'PRIMARY'},
        })).status).toBe('completed')
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.setMasterInfo,
            payload: {
                masterInfo: {
                    deviceId: 'master-device',
                    serverAddress: [{address: addressInfo.wsUrl}],
                    addedAt: Date.now() as any,
                },
            },
        })).status).toBe('completed')

        expect((await masterRuntime.execute({
            commandName: syncCommandName,
            payload: {
                entryKey: 'counter',
                value: 'master-value',
                updatedAt: 100,
            },
        })).status).toBe('completed')

        expect((await masterRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return selectTopologyClientConnection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        })

        await waitFor(() => {
            const slaveState = slaveRuntime.getState()
            const slaveSlice = slaveState[syncSliceName as keyof typeof slaveState] as
                | Record<string, {value: string; updatedAt: number}>
                | undefined
            return slaveSlice?.counter?.value === 'master-value'
        })

        const slaveState = slaveRuntime.getState()
        const slaveSlice = slaveState[syncSliceName as keyof typeof slaveState] as
            | Record<string, {value: string; updatedAt: number}>
            | undefined

        expect(slaveSlice).toEqual({
            counter: {
                value: 'master-value',
                updatedAt: 100,
            },
        })
        expect(selectTopologyClientSync(masterRuntime.getState())?.continuousSyncActive).toBe(true)
        expect(selectTopologyClientSync(slaveRuntime.getState())?.continuousSyncActive).toBe(true)

        masterSocketRuntime.disconnect('dual-topology.ws.state-sync', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.state-sync', 'test-complete')
    })
})
