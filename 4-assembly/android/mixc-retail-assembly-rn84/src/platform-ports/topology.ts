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
import {createAssemblyWebSocketTransport} from './transport'

const TOPOLOGY_PROFILE_NAME = 'assembly.android.mixc-retail-rn84.topology'

const normalizeWsBaseUrl = (wsUrl: string): string => {
    const url = new URL(wsUrl)
    return `${url.protocol}//${url.host}`.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
}

const normalizeWsPath = (wsUrl: string): string => new URL(wsUrl).pathname

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
    assemblyAppId: 'assembly.android.mixc-retail-rn84',
    assemblyVersion: '1.0.0',
    buildNumber: 1,
    bundleVersion: '1',
    runtimeVersion: '1.0.0',
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

    const role = topology.role ?? (props.displayIndex === 0 ? 'master' : 'slave')
    const socketRuntime = createSocketRuntime({
        logger: logger.scope({
            moduleName: 'assembly.android.mixc-retail-rn84',
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
                        baseUrl: normalizeWsBaseUrl(topology.wsUrl),
                    },
                ],
            },
        ],
    })
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: TOPOLOGY_PROFILE_NAME,
        serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST,
        pathTemplate: normalizeWsPath(topology.wsUrl),
        handshake: {
            headers: typed<Record<string, string>>('assembly.android.mixc-retail-rn84.topology.headers'),
        },
        messages: {
            incoming: typed('assembly.android.mixc-retail-rn84.topology.incoming'),
            outgoing: typed('assembly.android.mixc-retail-rn84.topology.outgoing'),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: Number.MAX_SAFE_INTEGER,
            reconnectDelayMs: 1_000,
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
