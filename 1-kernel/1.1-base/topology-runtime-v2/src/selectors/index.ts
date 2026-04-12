import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    TOPOLOGY_V2_CONNECTION_STATE_KEY,
    TOPOLOGY_V2_CONTEXT_STATE_KEY,
    TOPOLOGY_V2_PEER_STATE_KEY,
    TOPOLOGY_V2_RECOVERY_STATE_KEY,
    TOPOLOGY_V2_SYNC_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TopologyV2ConnectionState,
    TopologyV2ContextState,
    TopologyV2PeerState,
    TopologyV2RecoveryState,
    TopologyV2SyncState,
} from '../types'

export const selectTopologyRuntimeV2RecoveryState = (state: RootState) =>
    state[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof RootState] as TopologyV2RecoveryState | undefined

export const selectTopologyRuntimeV2Context = (state: RootState) =>
    state[TOPOLOGY_V2_CONTEXT_STATE_KEY as keyof RootState] as TopologyV2ContextState | undefined

export const selectTopologyRuntimeV2Connection = (state: RootState) =>
    state[TOPOLOGY_V2_CONNECTION_STATE_KEY as keyof RootState] as TopologyV2ConnectionState | undefined

export const selectTopologyRuntimeV2Peer = (state: RootState) =>
    state[TOPOLOGY_V2_PEER_STATE_KEY as keyof RootState] as TopologyV2PeerState | undefined

export const selectTopologyRuntimeV2Sync = (state: RootState) =>
    state[TOPOLOGY_V2_SYNC_STATE_KEY as keyof RootState] as TopologyV2SyncState | undefined

export const selectTopologyRuntimeV2Workspace = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.workspace

export const selectTopologyRuntimeV2DisplayMode = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.displayMode

export const selectTopologyRuntimeV2InstanceMode = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.instanceMode

export const selectTopologyRuntimeV2Standalone = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.standalone

export const selectTopologyRuntimeV2EnableSlave = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.enableSlave

export const selectTopologyRuntimeV2MasterInfo = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.masterInfo

export const selectTopologyRuntimeV2ServerConnected = (state: RootState) =>
    selectTopologyRuntimeV2Connection(state)?.serverConnectionStatus === 'CONNECTED'

export const selectTopologyRuntimeV2PeerConnected = (state: RootState) => {
    const peer = selectTopologyRuntimeV2Peer(state)
    return Boolean(peer?.peerNodeId && peer.connectedAt && !peer.disconnectedAt)
}
