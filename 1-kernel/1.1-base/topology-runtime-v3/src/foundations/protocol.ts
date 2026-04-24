import {
    JsonSocketCodec,
    defineSocketProfile,
} from '@next/kernel-base-transport-runtime'
import type {
    TopologyV3IncomingMessage,
    TopologyV3OutgoingMessage,
} from '../types/runtime'

export const TOPOLOGY_RUNTIME_V3_SOCKET_PROFILE_NAME =
    'dual-topology.ws.topology-runtime-v3'

export const topologyRuntimeV3SocketProfile = defineSocketProfile<
    void,
    void,
    Record<string, string>,
    TopologyV3IncomingMessage,
    TopologyV3OutgoingMessage
>({
    name: TOPOLOGY_RUNTIME_V3_SOCKET_PROFILE_NAME,
    serverName: 'dual-topology-host-v3',
    pathTemplate: '/ws',
    codec: new JsonSocketCodec<TopologyV3IncomingMessage, TopologyV3OutgoingMessage>(),
    meta: {
        reconnectAttempts: -1,
        reconnectDelayMs: 3_000,
    },
})
