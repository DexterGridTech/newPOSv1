import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    TOPOLOGY_V2_CONNECTION_STATE_KEY,
    TOPOLOGY_V2_CONTEXT_STATE_KEY,
    TOPOLOGY_V2_PEER_STATE_KEY,
    TOPOLOGY_V2_PROJECTION_STATE_KEY,
    TOPOLOGY_V2_RECOVERY_STATE_KEY,
    TOPOLOGY_V2_SYNC_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TopologyV2ConnectionState,
    TopologyV2ContextState,
    TopologyV2PeerState,
    TopologyV2ProjectionState,
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

export const selectTopologyRuntimeV2ProjectionState = (state: RootState) =>
    state[TOPOLOGY_V2_PROJECTION_STATE_KEY as keyof RootState] as TopologyV2ProjectionState | undefined

export const selectTopologyRuntimeV2RequestProjection = (state: RootState, requestId: string) =>
    selectTopologyRuntimeV2ProjectionState(state)?.requestProjections?.[requestId]

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

export const selectTopologyRuntimeV2LocalNodeId = (state: RootState) =>
    selectTopologyRuntimeV2Context(state)?.localNodeId

export const selectTopologyRuntimeV2ServerConnected = (state: RootState) =>
    selectTopologyRuntimeV2Connection(state)?.serverConnectionStatus === 'CONNECTED'

export const selectTopologyRuntimeV2PeerConnected = (state: RootState) => {
    const peer = selectTopologyRuntimeV2Peer(state)
    return Boolean(peer?.peerNodeId && peer.connectedAt && !peer.disconnectedAt)
}

export const selectTopologyRuntimeV2PeerNodeId = (state: RootState) =>
    selectTopologyRuntimeV2Peer(state)?.peerNodeId

export const selectTopologyRuntimeV2ScopedStateKey = (
    state: RootState,
    baseKey: string,
) => {
    const workspace = selectTopologyRuntimeV2Workspace(state)
    if (!workspace) {
        return undefined
    }
    return `${baseKey}.${workspace}`
}

/**
 * Package-neutral aliases for business modules that should not know the old
 * client/runtime split. Keep these names as the stable topology read API.
 */
export const selectTopologyContext = selectTopologyRuntimeV2Context
export const selectTopologyConnection = selectTopologyRuntimeV2Connection
export const selectTopologyPeer = selectTopologyRuntimeV2Peer
export const selectTopologySync = selectTopologyRuntimeV2Sync
export const selectTopologyRequestProjection = selectTopologyRuntimeV2RequestProjection
export const selectTopologyWorkspace = selectTopologyRuntimeV2Workspace
export const selectTopologyDisplayMode = selectTopologyRuntimeV2DisplayMode
export const selectTopologyInstanceMode = selectTopologyRuntimeV2InstanceMode
export const selectTopologyStandalone = selectTopologyRuntimeV2Standalone
export const selectTopologyEnableSlave = selectTopologyRuntimeV2EnableSlave
export const selectTopologyMasterInfo = selectTopologyRuntimeV2MasterInfo
export const selectTopologyLocalNodeId = selectTopologyRuntimeV2LocalNodeId
export const selectTopologyServerConnected = selectTopologyRuntimeV2ServerConnected
export const selectTopologyPeerConnected = selectTopologyRuntimeV2PeerConnected
export const selectTopologyPeerNodeId = selectTopologyRuntimeV2PeerNodeId
export const selectTopologyScopedStateKey = selectTopologyRuntimeV2ScopedStateKey
