import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTopologyRuntimeModuleV2,
    type CreateTopologyRuntimeModuleV2Input,
} from '../../src'
import {createDualTopologyHostServer} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/src'
import {fetchJson} from '/Users/dexter/Documents/workspace/idea/newPOSv1/0-mock-server/dual-topology-host/test/helpers/http'
import {createNodeWsTransport} from '/Users/dexter/Documents/workspace/idea/newPOSv1/1-kernel/1.1-base/transport-runtime/test/helpers/nodeWsTransport'

export const waitFor = async (predicate: () => boolean, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

export const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
}) => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'node',
        product: 'new-pos-test',
        assemblyAppId: 'assembly.test',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: '1.0.0',
        protocolVersion: '2026.04',
        capabilities: ['projection-mirror', 'dispatch-relay'],
    }
}

export const createHello = (ticketToken: string, runtime: ReturnType<typeof createRuntimeInfo>) => {
    return {
        helloId: `hello_${runtime.nodeId}`,
        ticketToken,
        runtime,
        sentAt: Date.now() as any,
    }
}

const createTestLogger = (moduleName: string) => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write() {},
        scope: {
            moduleName,
            layer: 'kernel',
        },
    })
}

export const createTopologyRuntimeV2LiveHarness = async (input: {
    profileName: string
}) => {
    const server = createDualTopologyHostServer({
        config: {
            port: 0,
            heartbeatIntervalMs: 50,
            heartbeatTimeoutMs: 5_000,
        },
    })
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

    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: input.profileName,
        serverName: 'dual-topology-host',
        pathTemplate: '/mockMasterServer/ws',
        handshake: {
            headers: typed<Record<string, string>>(`${input.profileName}.headers`),
        },
        messages: {
            incoming: typed(`${input.profileName}.incoming`),
            outgoing: typed(`${input.profileName}.outgoing`),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: 0,
        },
    })

    const createAssembly = (runtimeInput: {
        nodeId: string
        role: 'master' | 'slave'
        deviceId: string
    }): CreateTopologyRuntimeModuleV2Input['assembly'] => {
        const socketRuntime = createSocketRuntime({
            logger: createTestLogger(`${input.profileName}.${runtimeInput.role}-socket`),
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

        return {
            resolveSocketBinding() {
                return {
                    socketRuntime,
                    profileName: input.profileName,
                    profile,
                }
            },
            createHello() {
                return createHello(ticket.token, createRuntimeInfo({
                    nodeId: runtimeInput.nodeId,
                    deviceId: runtimeInput.deviceId,
                    role: runtimeInput.role,
                }))
            },
        }
    }

    const createRuntime = (runtimeInput: {
        nodeId: string
        role: 'master' | 'slave'
        deviceId: string
    }) => {
        return createKernelRuntimeV2({
            localNodeId: runtimeInput.nodeId as any,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createTestLogger(`${input.profileName}.${runtimeInput.role}-runtime`),
            }),
            modules: [
                createTopologyRuntimeModuleV2({
                    assembly: createAssembly(runtimeInput),
                }),
            ],
        })
    }

    return {
        server,
        addressInfo,
        masterNodeId,
        slaveNodeId,
        createMasterRuntime() {
            return createRuntime({
                nodeId: masterNodeId,
                role: 'master',
                deviceId: 'master-device',
            })
        },
        createSlaveRuntime() {
            return createRuntime({
                nodeId: slaveNodeId,
                role: 'slave',
                deviceId: 'slave-device',
            })
        },
        async close() {
            await server.close()
        },
    }
}
