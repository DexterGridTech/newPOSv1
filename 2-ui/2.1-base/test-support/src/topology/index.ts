import type {
    CreateTopologyRuntimeModuleV3Input,
    TopologyV3HelloRuntime,
} from '@next/kernel-base-topology-runtime-v3'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_DUAL_TOPOLOGY_HOST_V3} from '@next/kernel-server-config-v2'
import {createBrowserConsoleLogger} from '../logger'
import {createExternalTopologyHostPort} from '../platform'
import {createBrowserWsTransport} from '../transport'

export interface ExpoWebTopologyHostAddress {
    httpBaseUrl?: string
    wsUrl?: string
}

export interface CreateExpoWebTopologyAssemblyInput {
    address: ExpoWebTopologyHostAddress
    deviceId: string
    loggerModuleName: string
    profileName: string
    standalone?: boolean
}

export const createExpoWebTopologyRuntimeInfo = (input: {
    deviceId: string
    displayMode?: 'PRIMARY' | 'SECONDARY'
    instanceMode?: 'MASTER' | 'SLAVE'
    nodeId: string
    standalone?: boolean
}): TopologyV3HelloRuntime => ({
    nodeId: input.nodeId,
    deviceId: input.deviceId,
    instanceMode: input.instanceMode ?? 'MASTER',
    displayMode: input.displayMode ?? 'PRIMARY',
    standalone: input.standalone ?? true,
    protocolVersion: '2026.04-v3',
    capabilities: ['state-sync', 'command-relay', 'request-mirror'],
})

export const createExpoWebTopologyHostPort = (
    address: ExpoWebTopologyHostAddress,
): ReturnType<typeof createExternalTopologyHostPort> | undefined => address.httpBaseUrl
    ? createExternalTopologyHostPort({
        httpBaseUrl: address.httpBaseUrl,
        wsUrl: address.wsUrl,
    })
    : undefined

export const createExpoWebTopologyAssembly = (
    input: CreateExpoWebTopologyAssemblyInput,
): CreateTopologyRuntimeModuleV3Input | undefined => {
    if (!input.address.httpBaseUrl || !input.address.wsUrl) {
        return undefined
    }
    const wsUrl = new URL(input.address.wsUrl)
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: input.profileName,
        serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
        pathTemplate: wsUrl.pathname,
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
    const socketRuntime = createSocketRuntime({
        logger: createBrowserConsoleLogger({
            environmentMode: 'DEV',
            scope: {
                moduleName: input.loggerModuleName,
                layer: 'ui',
                subsystem: 'transport.ws',
            },
        }),
        transport: createBrowserWsTransport(),
        servers: [
            {
                serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: wsUrl.origin,
                    },
                ],
            },
        ],
    })

    return {
        assembly: {
            resolveSocketBinding() {
                return {
                    socketRuntime,
                    profileName: profile.name,
                    profile,
                }
            },
            createHelloRuntime(context) {
                return createExpoWebTopologyRuntimeInfo({
                    nodeId: String(context.localNodeId),
                    deviceId: input.deviceId,
                    standalone: input.standalone,
                })
            },
        },
        socket: {
            reconnectAttempts: 0,
        },
    }
}
