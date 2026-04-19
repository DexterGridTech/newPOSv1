import type {
    TopologyV3HelloAckMessage,
    TopologyV3HelloMessage,
    TopologyV3HelloRuntime,
} from '../types/runtime'
import type {
    TopologyV3PeerState,
    TopologyV3SyncState,
} from '../types/state'

export interface TopologyV3PairLinkState {
    connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    peer: TopologyV3PeerState
    sync: TopologyV3SyncState
}

export const createTopologyV3Hello = (input: {
    helloId: string
    runtime: TopologyV3HelloRuntime
    sentAt?: number
}): TopologyV3HelloMessage => ({
    type: 'hello',
    helloId: input.helloId,
    runtime: input.runtime,
    sentAt: input.sentAt ?? Date.now(),
})

export const createTopologyV3InitialPairLinkState = (): TopologyV3PairLinkState => ({
    connectionStatus: 'DISCONNECTED',
    peer: {},
    sync: {
        status: 'idle',
    },
})

export const applyTopologyV3HelloAck = (
    state: TopologyV3PairLinkState,
    ack: TopologyV3HelloAckMessage,
    now = Date.now(),
): TopologyV3PairLinkState => {
    if (!ack.accepted || !ack.sessionId) {
        return {
            ...state,
            connectionStatus: 'DISCONNECTED',
            sync: {
                ...state.sync,
                status: 'idle',
                activeSessionId: undefined,
            },
        }
    }

    return {
        connectionStatus: 'CONNECTED',
        peer: ack.peerRuntime
            ? {
                peerNodeId: ack.peerRuntime.nodeId,
                peerDeviceId: ack.peerRuntime.deviceId,
                peerRuntime: ack.peerRuntime,
                connectedAt: now,
                disconnectedAt: undefined,
            }
            : state.peer,
        sync: {
            ...state.sync,
            activeSessionId: ack.sessionId,
            status: 'active',
        },
    }
}

export const markTopologyV3PairDisconnected = (
    state: TopologyV3PairLinkState,
    now = Date.now(),
): TopologyV3PairLinkState => ({
    connectionStatus: 'DISCONNECTED',
    peer: {
        ...state.peer,
        disconnectedAt: now,
    },
    sync: {
        ...state.sync,
        status: 'idle',
        activeSessionId: undefined,
    },
})
