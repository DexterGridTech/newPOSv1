import {describe, expect, it} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTopologyClientRuntimeModule,
    selectTopologyClientConnection,
    selectTopologyClientPeer,
    selectTopologyClientSync,
    selectTopologyPeerConnected,
    selectTopologyPeerNodeId,
    selectTopologyServerConnected,
    topologyClientParameterDefinitions,
    topologyClientErrorDefinitions,
    topologyClientCommandNames,
} from '../../src'
import {
    createDualTopologyHost,
    createDualTopologyHostServer,
} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {
    createHello,
    createRuntimeInfo,
    installTopologyClientServerCleanup,
    topologyClientTestServers,
    waitFor,
} from '../helpers/topologyClientHarness'
import {
    configureTopologyPair,
    createTopologyHostLiveHarness,
    startTopologyConnectionPair,
} from '../helpers/liveHarness'

installTopologyClientServerCleanup()

describe('topology-client-runtime connection', () => {
    it('registers topology client parameter defaults and resolves startup overrides', async () => {
        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.parameter-resolution',
                        layer: 'kernel',
                    },
                }),
            }),
            startupSeed: {
                parameterCatalog: {
                    [topologyClientParameterDefinitions.serverReconnectIntervalMs.key]: {
                        key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
                        rawValue: 321,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                },
            },
            modules: [
                createTopologyClientRuntimeModule(),
            ],
        })

        await runtime.start()

        expect(runtime.resolveParameter<number>({
            key: topologyClientParameterDefinitions.serverConnectionTimeoutMs.key,
        })).toMatchObject({
            value: 10_000,
            source: 'catalog',
            valid: true,
        })

        expect(runtime.resolveParameter<number>({
            key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
        })).toMatchObject({
            value: 321,
            source: 'catalog',
            valid: true,
        })

        expect(runtime.resolveParameter<number>({
            key: topologyClientParameterDefinitions.serverReconnectAttempts.key,
        })).toMatchObject({
            value: -1,
            source: 'catalog',
            valid: true,
        })

        expect(runtime.resolveParameter<number>({
            key: topologyClientParameterDefinitions.remoteCommandResponsePollIntervalMs.key,
        })).toMatchObject({
            value: 10,
            source: 'catalog',
            valid: true,
        })
    })

    it('fails with structured error when public start command has no socket binding', async () => {
        const runtime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.binding-required',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return undefined
                        },
                        createHello() {
                            throw new Error('should not create hello without socket binding')
                        },
                    },
                }),
            ],
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })

        expect(result.status).toBe('failed')
        if (result.status !== 'failed') {
            throw new Error('expected topology start command to fail without socket binding')
        }

        expect(result.error).toMatchObject({
            key: topologyClientErrorDefinitions.socketBindingUnavailable.key,
            category: 'SYSTEM',
        })
        expect(runtime.resolveParameter<number>({
            key: topologyClientParameterDefinitions.remoteCommandResponsePollIntervalMs.key,
        })).toMatchObject({
            value: 10,
            source: 'catalog',
            valid: true,
        })
    })

    it('controls topology connection lifecycle through public commands', async () => {
        const hostHarness = await createTopologyHostLiveHarness({
            profileName: 'dual-topology.ws.public-connection',
        })

        const ownerRuntime = createKernelRuntime({
            localNodeId: hostHarness.masterNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.public-connection.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: hostHarness.createMasterAssembly(),
                }),
            ],
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: hostHarness.slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.public-connection.slave-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: hostHarness.createSlaveAssembly(),
                }),
            ],
        })

        await ownerRuntime.start()
        await slaveRuntime.start()

        await configureTopologyPair({
            masterRuntime: ownerRuntime,
            slaveRuntime,
            masterWsUrl: hostHarness.addressInfo.wsUrl,
        })
        await startTopologyConnectionPair({
            masterRuntime: ownerRuntime,
            slaveRuntime,
        })

        expect(selectTopologyClientSync(ownerRuntime.getState())?.activeSessionId).toBeTruthy()

        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.stopTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'DISCONNECTED'
        })

        expect(selectTopologyClientSync(slaveRuntime.getState())?.activeSessionId).toBeUndefined()

        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.restartTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && Boolean(selectTopologyClientPeer(slaveRuntime.getState())?.peerNodeId)
        })

        expect(selectTopologyClientSync(ownerRuntime.getState())?.activeSessionId).toBeTruthy()

        expect((await ownerRuntime.execute({
            commandName: topologyClientCommandNames.resumeTopologySession,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return Boolean(selectTopologyClientConnection(ownerRuntime.getState())?.lastResumeAt)
        })

        hostHarness.disconnect()
    })

    it('retries connection by parameter interval and connects after dual topology host becomes available', async () => {
        const delayedPort = 48991
        const serverBaseUrl = `http://127.0.0.1:${delayedPort}`
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const host = createDualTopologyHost({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.delayed-connect.host',
                    layer: 'mock-server',
                },
            }),
            heartbeatTimeoutMs: 5_000,
        })
        const ticket = host.hostRuntime.issueTicket({
            masterNodeId,
            transportUrls: [`ws://127.0.0.1:${delayedPort}/mockMasterServer/ws`],
            expiresInMs: 5 * 60 * 1000,
        })

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.delayed-connect.slave-socket',
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
            name: 'dual-topology.ws.delayed-connect',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.delayed-connect.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.delayed-connect.incoming'),
                outgoing: typed('dual-topology.ws.delayed-connect.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.delayed-connect.runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            startupSeed: {
                parameterCatalog: {
                    [topologyClientParameterDefinitions.serverReconnectIntervalMs.key]: {
                        key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
                        rawValue: 80,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                    [topologyClientParameterDefinitions.serverConnectionTimeoutMs.key]: {
                        key: topologyClientParameterDefinitions.serverConnectionTimeoutMs.key,
                        rawValue: 120,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                },
            },
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.delayed-connect',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello(ticket.ticket.token, createRuntimeInfo({
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
                serverAddress: [{address: `ws://127.0.0.1:${delayedPort}/mockMasterServer/ws`}],
                addedAt: Date.now() as any,
            },
        })

        await slaveRuntime.start()
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            const connection = selectTopologyClientConnection(slaveRuntime.getState())
            return (connection?.reconnectAttempt ?? 0) >= 1
                && Boolean(connection?.connectionError)
        }, 2_000)

        const server = createDualTopologyHostServer({
            host,
            config: {
                port: delayedPort,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        topologyClientTestServers.push(server)
        await server.start()

        const ownerSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.delayed-connect.owner-socket',
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

        ownerSocketRuntime.registerProfile(profile)
        await ownerSocketRuntime.connect('dual-topology.ws.delayed-connect')
        ownerSocketRuntime.send('dual-topology.ws.delayed-connect', {
            type: 'node-hello',
            hello: createHello(ticket.ticket.token, createRuntimeInfo({
                nodeId: masterNodeId,
                deviceId: 'master-device',
                role: 'master',
            })),
        })

        await waitFor(() => {
            const connection = selectTopologyClientConnection(slaveRuntime.getState())
            return connection?.serverConnectionStatus === 'CONNECTED'
        }, 4_000)

        expect(selectTopologyClientPeer(slaveRuntime.getState())?.peerNodeId).toBe(masterNodeId)
        expect(selectTopologyPeerNodeId(slaveRuntime.getState())).toBe(masterNodeId)
        expect(selectTopologyPeerConnected(slaveRuntime.getState())).toBe(true)
        expect(selectTopologyServerConnected(slaveRuntime.getState())).toBe(true)
        expect(selectTopologyClientConnection(slaveRuntime.getState())?.reconnectAttempt).toBe(0)

        ownerSocketRuntime.disconnect('dual-topology.ws.delayed-connect', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.delayed-connect', 'test-complete')
    })

    it('stops scheduling reconnect after configured reconnect attempts are exhausted', async () => {
        const delayedPort = 48992
        const serverBaseUrl = `http://127.0.0.1:${delayedPort}`
        const slaveNodeId = createNodeId()

        const slaveSocketRuntime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.topology-client-runtime.test.reconnect-limit.slave-socket',
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
            name: 'dual-topology.ws.reconnect-limit',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.reconnect-limit.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.reconnect-limit.incoming'),
                outgoing: typed('dual-topology.ws.reconnect-limit.outgoing'),
            },
            codec: new JsonSocketCodec(),
            meta: {
                reconnectAttempts: 0,
            },
        })

        const slaveRuntime = createKernelRuntime({
            localNodeId: slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.reconnect-limit.runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            startupSeed: {
                parameterCatalog: {
                    [topologyClientParameterDefinitions.serverReconnectIntervalMs.key]: {
                        key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
                        rawValue: 60,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                    [topologyClientParameterDefinitions.serverConnectionTimeoutMs.key]: {
                        key: topologyClientParameterDefinitions.serverConnectionTimeoutMs.key,
                        rawValue: 80,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                },
            },
            modules: [
                createTopologyClientRuntimeModule({
                    socket: {
                        reconnectAttempts: 2,
                    },
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: slaveSocketRuntime,
                                profileName: 'dual-topology.ws.reconnect-limit',
                                profile,
                            }
                        },
                        createHello() {
                            return createHello('unreachable-ticket', createRuntimeInfo({
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
                serverAddress: [{address: `ws://127.0.0.1:${delayedPort}/mockMasterServer/ws`}],
                addedAt: Date.now() as any,
            },
        })

        await slaveRuntime.start()
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return selectTopologyClientConnection(slaveRuntime.getState())?.reconnectAttempt === 2
        }, 2_000)

        const reconnectAttemptAtLimit = selectTopologyClientConnection(slaveRuntime.getState())?.reconnectAttempt
        await new Promise(resolve => setTimeout(resolve, 250))

        const connection = selectTopologyClientConnection(slaveRuntime.getState())
        expect(reconnectAttemptAtLimit).toBe(2)
        expect(connection?.reconnectAttempt).toBe(2)
        expect(connection?.serverConnectionStatus).toBe('DISCONNECTED')
        expect(connection?.connectionError).toBeTruthy()
        expect(selectTopologyServerConnected(slaveRuntime.getState())).toBe(false)
    })

    it('connects through assembly injected node ws adapter and projects peer/connection state', async () => {
        const hostHarness = await createTopologyHostLiveHarness({
            profileName: 'dual-topology.ws',
        })
        await hostHarness.connectMasterHello()

        const slaveRuntime = createKernelRuntime({
            localNodeId: hostHarness.slaveNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.topology-client-runtime.test.client-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: hostHarness.createSlaveAssembly(),
                }),
            ],
        })

        slaveRuntime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            enableSlave: false,
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: hostHarness.addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        })

        await slaveRuntime.start()

        await waitFor(() => {
            const connection = selectTopologyClientConnection(slaveRuntime.getState())
            return connection?.serverConnectionStatus === 'CONNECTED'
        })

        const connection = selectTopologyClientConnection(slaveRuntime.getState())
        const peer = selectTopologyClientPeer(slaveRuntime.getState())

        expect(connection?.serverConnectionStatus).toBe('CONNECTED')
        expect(connection?.lastHelloAt).toBeDefined()
        expect(selectTopologyServerConnected(slaveRuntime.getState())).toBe(true)
        expect(peer?.peerNodeId).toBe(hostHarness.masterNodeId)
        expect(peer?.peerDeviceId).toBe('master-device')
        expect(peer?.peerInstanceMode).toBe('MASTER')
        expect(selectTopologyPeerNodeId(slaveRuntime.getState())).toBe(hostHarness.masterNodeId)
        expect(selectTopologyPeerConnected(slaveRuntime.getState())).toBe(true)

        hostHarness.disconnect()
    })
})
