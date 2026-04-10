import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    TOPOLOGY_CLIENT_CONNECTION_STATE_KEY,
    TOPOLOGY_CLIENT_CONTEXT_STATE_KEY,
    TOPOLOGY_CLIENT_PEER_STATE_KEY,
    TOPOLOGY_CLIENT_SYNC_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TopologyClientConnectionState,
    TopologyClientContextState,
    TopologyClientPeerState,
    TopologyClientSyncState,
} from '../types'

export const selectTopologyClientContext = (state: RootState) =>
    state[TOPOLOGY_CLIENT_CONTEXT_STATE_KEY as keyof RootState] as TopologyClientContextState | undefined

export const selectTopologyClientConnection = (state: RootState) =>
    state[TOPOLOGY_CLIENT_CONNECTION_STATE_KEY as keyof RootState] as TopologyClientConnectionState | undefined

export const selectTopologyClientPeer = (state: RootState) =>
    state[TOPOLOGY_CLIENT_PEER_STATE_KEY as keyof RootState] as TopologyClientPeerState | undefined

export const selectTopologyClientSync = (state: RootState) =>
    state[TOPOLOGY_CLIENT_SYNC_STATE_KEY as keyof RootState] as TopologyClientSyncState | undefined

export const selectTopologyWorkspace = (state: RootState) =>
    selectTopologyClientContext(state)?.workspace

export const selectTopologyDisplayMode = (state: RootState) =>
    selectTopologyClientContext(state)?.displayMode

export const selectTopologyInstanceMode = (state: RootState) =>
    selectTopologyClientContext(state)?.instanceMode
