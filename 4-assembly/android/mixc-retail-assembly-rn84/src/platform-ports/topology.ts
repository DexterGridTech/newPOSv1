import type {NodeHello, NodeRuntimeInfo} from '@impos2/kernel-base-contracts'
import {
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    typed,
} from '@impos2/kernel-base-transport-runtime'
import type {TopologyRuntimeV2Assembly, CreateTopologyRuntimeModuleV2Input} from '@impos2/kernel-base-topology-runtime-v2'
import {SERVER_NAME_DUAL_TOPOLOGY_HOST} from '@impos2/kernel-server-config-v2'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {AppProps, AssemblyTopologyLaunchOptions} from '../types'
import {moduleName} from '../moduleName'
import {releaseInfo} from '../generated/releaseInfo'
import {createAssemblyWebSocketTransport} from './transport'

const TOPOLOGY_PROFILE_NAME = `${moduleName}.topology`

const parseWsUrl = (wsUrl: string): {
    protocol: string
    host: string
    pathname: string
} => {
    const match = wsUrl.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(\/[^?#]*)?/i)
    if (!match) {
        throw new Error(`Topology wsUrl is invalid: ${wsUrl}`)
    }
    const [, protocol, host, pathname] = match
    if (!host) {
        throw new Error(`Topology wsUrl host is empty: ${wsUrl}`)
    }
    return {
        protocol,
        host,
        pathname: pathname || '/',
    }
}

const normalizeWsBaseUrl = (parsed: ReturnType<typeof parseWsUrl>): string => {
    switch (parsed.protocol.toLowerCase()) {
        case 'ws':
            return `http://${parsed.host}`
        case 'wss':
            return `https://${parsed.host}`
        default:
            throw new Error(`Topology wsUrl protocol is unsupported: ${parsed.protocol}`)
    }
}

const createRuntimeInfo = (
    props: AppProps,
    localNodeId: string,
    role: NonNullable<AssemblyTopologyLaunchOptions['role']>,
): NodeRuntimeInfo => ({
    nodeId: localNodeId as any,
    deviceId: props.deviceId,
    role,
    platform: 'android',
    product: 'mixc-retail',
    assemblyAppId: releaseInfo.appId,
    assemblyVersion: releaseInfo.assemblyVersion,
    buildNumber: releaseInfo.buildNumber,
    bundleVersion: releaseInfo.bundleVersion,
    runtimeVersion: releaseInfo.runtimeVersion,
    protocolVersion: '2026.04',
    capabilities: ['projection-mirror', 'dispatch-relay', 'state-sync'],
})

export const createAssemblyTopologyInput = (
    props: AppProps,
    logger: LoggerPort,
): CreateTopologyRuntimeModuleV2Input | undefined => {
    const topology = props.topology
    if (!topology?.ticketToken || !topology.wsUrl) {
        return undefined
    }
    const parsedWsUrl = parseWsUrl(topology.wsUrl)
    const normalizedBaseUrl = normalizeWsBaseUrl(parsedWsUrl)
    const normalizedPath = parsedWsUrl.pathname

    const role = topology.role ?? (props.displayIndex === 0 ? 'master' : 'slave')
    const socketRuntime = createSocketRuntime({
        logger: logger.scope({
            moduleName,
            layer: 'assembly',
            subsystem: 'topology',
            component: 'SocketRuntime',
        }),
        transport: createAssemblyWebSocketTransport(),
        servers: [
            {
                serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST,
                addresses: [
                    {
                        addressName: 'native-topology-host',
                        baseUrl: normalizedBaseUrl,
                    },
                ],
            },
        ],
    })
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: TOPOLOGY_PROFILE_NAME,
        serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST,
        pathTemplate: normalizedPath,
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
    logger.info({
        category: 'assembly.topology',
        event: 'topology-socket-binding-created',
        message: 'Create assembly topology socket binding',
        data: {
            displayIndex: props.displayIndex,
            role,
            localNodeId: topology.localNodeId,
            masterNodeId: topology.masterNodeId,
            rawWsUrl: topology.wsUrl,
            parsedProtocol: parsedWsUrl.protocol,
            parsedHost: parsedWsUrl.host,
            normalizedBaseUrl,
            normalizedPath,
        },
    })
    const assembly: TopologyRuntimeV2Assembly = {
        resolveSocketBinding() {
            return {
                socketRuntime,
                profileName: profile.name,
                profile,
            }
        },
        createHello(context): NodeHello {
            const runtime = createRuntimeInfo(props, String(context.localNodeId), role)
            return {
                helloId: `hello_${runtime.nodeId}_${Date.now()}` as any,
                ticketToken: topology.ticketToken as any,
                runtime,
                sentAt: Date.now() as any,
            }
        },
        getRuntimeInfo(context) {
            return createRuntimeInfo(props, String(context.localNodeId), role)
        },
    }

    return {assembly}
}
