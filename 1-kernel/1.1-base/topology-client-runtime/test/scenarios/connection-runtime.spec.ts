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
    topologyClientCommandNames,
} from '../../src'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'
import {
    createHello,
    createRuntimeInfo,
    installTopologyClientServerCleanup,
    topologyClientTestServers,
    waitFor,
} from './helpers'

installTopologyClientServerCleanup()

describe('topology-client-runtime connection', () => {
    it('controls topology connection lifecycle through public commands', async () => {
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
                    moduleName: 'kernel.base.topology-client-runtime.test.public-connection.master-socket',
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
                    moduleName: 'kernel.base.topology-client-runtime.test.public-connection.slave-socket',
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
            name: 'dual-topology.ws.public-connection',
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {
                headers: typed<Record<string, string>>('dual-topology.ws.public-connection.headers'),
            },
            messages: {
                incoming: typed('dual-topology.ws.public-connection.incoming'),
                outgoing: typed('dual-topology.ws.public-connection.outgoing'),
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
                        moduleName: 'kernel.base.topology-client-runtime.test.public-connection.owner-runtime',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                createTopologyClientRuntimeModule({
                    assembly: {
                        resolveSocketBinding() {
                            return {
                                socketRuntime: masterSocketRuntime,
                                profileName: 'dual-topology.ws.public-connection',
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
                        moduleName: 'kernel.base.topology-client-runtime.test.public-connection.slave-runtime',
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
                                profileName: 'dual-topology.ws.public-connection',
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

        await ownerRuntime.start()
        await slaveRuntime.start()

        expect((await ownerRuntime.execute({
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

        expect((await ownerRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')
        expect((await slaveRuntime.execute({
            commandName: topologyClientCommandNames.startTopologyConnection,
            payload: {},
        })).status).toBe('completed')

        await waitFor(() => {
            return selectTopologyClientConnection(ownerRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyClientConnection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
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

        masterSocketRuntime.disconnect('dual-topology.ws.public-connection', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws.public-connection', 'test-complete')
    })

    it('connects through assembly injected node ws adapter and projects peer/connection state', async () => {
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
                    moduleName: 'kernel.base.topology-client-runtime.test.master-socket',
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
                    moduleName: 'kernel.base.topology-client-runtime.test.slave-socket',
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

        masterSocketRuntime.registerProfile(profile)
        await masterSocketRuntime.connect('dual-topology.ws')
        masterSocketRuntime.send('dual-topology.ws', {
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
                        moduleName: 'kernel.base.topology-client-runtime.test.client-runtime',
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
                                profileName: 'dual-topology.ws',
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

        await slaveRuntime.start()

        await waitFor(() => {
            const connection = selectTopologyClientConnection(slaveRuntime.getState())
            return connection?.serverConnectionStatus === 'CONNECTED'
        })

        const connection = selectTopologyClientConnection(slaveRuntime.getState())
        const peer = selectTopologyClientPeer(slaveRuntime.getState())

        expect(connection?.serverConnectionStatus).toBe('CONNECTED')
        expect(connection?.lastHelloAt).toBeDefined()
        expect(peer?.peerNodeId).toBe(masterNodeId)
        expect(peer?.peerDeviceId).toBe('master-device')
        expect(peer?.peerInstanceMode).toBe('MASTER')

        masterSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
        slaveSocketRuntime.disconnect('dual-topology.ws', 'test-complete')
    })
})
