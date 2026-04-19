import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import type {TopologyRuntimeV3Assembly, CreateTopologyRuntimeModuleV3Input, TopologyV3HelloRuntime} from '@impos2/kernel-base-topology-runtime-v3'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createAssemblyTopologyBindingSource,
    type AssemblyTopologyBindingSource,
    type AssemblyTopologyBindingState,
} from '../application/topology'
import {SERVER_NAME_DUAL_TOPOLOGY_HOST_V3} from '@impos2/kernel-server-config-v2'
import type {AppProps, AssemblyTopologyLaunchOptions} from '../types'
import {moduleName} from '../moduleName'
import {createAssemblyWebSocketTransport} from './transport'

const TOPOLOGY_PROFILE_NAME = `${moduleName}.topology`

const createRuntimeInfo = (
    props: AppProps,
    localNodeId: string,
    role: NonNullable<AssemblyTopologyLaunchOptions['role']>,
): TopologyV3HelloRuntime => ({
    nodeId: localNodeId as any,
    deviceId: props.deviceId,
    instanceMode: role === 'slave' ? 'SLAVE' : 'MASTER',
    displayMode: props.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY',
    standalone: props.displayIndex === 0,
    protocolVersion: '2026.04-v3',
    capabilities: ['state-sync', 'command-relay', 'request-mirror'],
})

const createBindingSeedFromLaunch = (
    props: AppProps,
): AssemblyTopologyBindingState | undefined => {
    const topology = props.topology
    if (!topology?.localNodeId) {
        return undefined
    }
    return {
        role: topology.role ?? (props.displayIndex === 0 ? 'master' : 'slave'),
        localNodeId: topology.localNodeId,
        masterNodeId: topology.masterNodeId,
        wsUrl: topology.wsUrl,
        httpBaseUrl: topology.httpBaseUrl,
    }
}

const createTopologyServerDefinition = (
    bindingSource: AssemblyTopologyBindingSource,
) => {
    const server = bindingSource.resolveServer()
    if (!server) {
        return undefined
    }
        return {
            serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
            addresses: [
                {
                    addressName: 'dynamic-topology-host',
                baseUrl: server.baseUrl,
            },
        ],
        pathTemplate: server.pathTemplate,
    }
}

export const createAssemblyTopologyInput = (
    props: AppProps,
    logger: LoggerPort,
    options: {
        bindingSource?: AssemblyTopologyBindingSource
    } = {},
): CreateTopologyRuntimeModuleV3Input | undefined => {
    const launchSeed = createBindingSeedFromLaunch(props)
    const bindingSource = options.bindingSource
        ?? (launchSeed ? createAssemblyTopologyBindingSource(launchSeed) : undefined)

    if (!bindingSource) {
        return undefined
    }
    if (launchSeed) {
        bindingSource.set(launchSeed)
    }

    const current = bindingSource.get()
    if (!current.localNodeId) {
        return undefined
    }

    const serverDefinition = createTopologyServerDefinition(bindingSource)
    const initialPath = serverDefinition?.pathTemplate ?? '/ws'

    const socketRuntime = createSocketRuntime({
        logger: logger.scope({
            moduleName,
            layer: 'assembly',
            subsystem: 'topology',
            component: 'SocketRuntime',
        }),
        transport: createAssemblyWebSocketTransport(),
        servers: serverDefinition ? [{
            serverName: serverDefinition.serverName,
            addresses: serverDefinition.addresses,
        }] : [],
    })
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: TOPOLOGY_PROFILE_NAME,
        serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
        pathTemplate: initialPath,
        handshake: {
            headers: typed<Record<string, string>>(`${TOPOLOGY_PROFILE_NAME}.headers`),
        },
        messages: {
            incoming: typed(`${TOPOLOGY_PROFILE_NAME}.incoming`),
            outgoing: typed(`${TOPOLOGY_PROFILE_NAME}.outgoing`),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: Number.MAX_SAFE_INTEGER,
            reconnectDelayMs: 1_000,
        },
    })
    const assembly: TopologyRuntimeV3Assembly = {
        resolveSocketBinding() {
            const nextServer = createTopologyServerDefinition(bindingSource)
            if (nextServer) {
                socketRuntime.replaceServers([{
                    serverName: nextServer.serverName,
                    addresses: nextServer.addresses,
                }])
            }
            const snapshot = bindingSource.get()
            logger.info({
                category: 'assembly.topology',
                event: 'topology-socket-binding-created',
                message: 'Create assembly topology socket binding',
                data: {
                    displayIndex: props.displayIndex,
                    role: snapshot.role,
                    localNodeId: snapshot.localNodeId,
                    masterNodeId: snapshot.masterNodeId,
                    wsUrl: snapshot.wsUrl,
                    httpBaseUrl: snapshot.httpBaseUrl,
                    resolvedServerBaseUrl: nextServer?.addresses[0]?.baseUrl,
                    resolvedPathTemplate: profile.pathTemplate,
                },
            })
            return {
                socketRuntime,
                profileName: profile.name,
                profile,
            }
        },
        createHelloRuntime(context): TopologyV3HelloRuntime | undefined {
            const snapshot = bindingSource.get()
            return createRuntimeInfo(
                props,
                snapshot.localNodeId || String(context.localNodeId),
                snapshot.role,
            )
        },
    }

    return {assembly}
}
