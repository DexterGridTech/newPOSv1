import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    TOPOLOGY_V3_CONFIG_STATE_KEY,
    TOPOLOGY_V3_CONNECTION_STATE_KEY,
    TOPOLOGY_V3_CONTEXT_STATE_KEY,
    TOPOLOGY_V3_DEMO_MASTER_STATE_KEY,
    TOPOLOGY_V3_DEMO_SLAVE_STATE_KEY,
    TOPOLOGY_V3_PEER_STATE_KEY,
    TOPOLOGY_V3_REQUEST_MIRROR_STATE_KEY,
    TOPOLOGY_V3_SYNC_STATE_KEY,
} from '../foundations/stateKeys'
import type {
    TopologyV3ConfigRuntimeState,
    TopologyV3ConnectionState,
    TopologyV3ContextState,
    TopologyV3DemoRecordState,
    TopologyV3PeerState,
    TopologyV3RequestMirrorState,
    TopologyV3SyncState,
} from '../types/state'
import type {TopologyV3ActivationStatus} from '../types/runtime'
import {
    getTopologyV3DisplayModeEligibility,
    getTopologyV3EnableSlaveEligibility,
    getTopologyV3SwitchToSlaveEligibility,
    getTopologyV3TcpActivationEligibility,
} from '../foundations/eligibility'

export const selectTopologyRuntimeV3ConfigState = (state: RootState) =>
    state[TOPOLOGY_V3_CONFIG_STATE_KEY as keyof RootState] as TopologyV3ConfigRuntimeState | undefined

export const selectTopologyRuntimeV3Context = (state: RootState) =>
    state[TOPOLOGY_V3_CONTEXT_STATE_KEY as keyof RootState] as TopologyV3ContextState | undefined

export const selectTopologyRuntimeV3Connection = (state: RootState) =>
    state[TOPOLOGY_V3_CONNECTION_STATE_KEY as keyof RootState] as TopologyV3ConnectionState | undefined

export const selectTopologyRuntimeV3Peer = (state: RootState) =>
    state[TOPOLOGY_V3_PEER_STATE_KEY as keyof RootState] as TopologyV3PeerState | undefined

export const selectTopologyRuntimeV3Sync = (state: RootState) =>
    state[TOPOLOGY_V3_SYNC_STATE_KEY as keyof RootState] as TopologyV3SyncState | undefined

export const selectTopologyRuntimeV3RequestMirror = (state: RootState) =>
    state[TOPOLOGY_V3_REQUEST_MIRROR_STATE_KEY as keyof RootState] as TopologyV3RequestMirrorState | undefined

export const selectTopologyRuntimeV3DemoMasterState = (state: RootState) =>
    state[TOPOLOGY_V3_DEMO_MASTER_STATE_KEY as keyof RootState] as TopologyV3DemoRecordState | undefined

export const selectTopologyRuntimeV3DemoSlaveState = (state: RootState) =>
    state[TOPOLOGY_V3_DEMO_SLAVE_STATE_KEY as keyof RootState] as TopologyV3DemoRecordState | undefined

export const selectTopologyRuntimeV3Workspace = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.workspace

export const selectTopologyRuntimeV3DisplayMode = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.displayMode

export const selectTopologyRuntimeV3InstanceMode = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.instanceMode

export const selectTopologyRuntimeV3Standalone = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.standalone

export const selectTopologyRuntimeV3EnableSlave = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.enableSlave

export const selectTopologyRuntimeV3MasterLocator = (state: RootState) =>
    selectTopologyRuntimeV3Context(state)?.masterLocator

export const selectTopologyRuntimeV3PeerNodeId = (state: RootState) =>
    selectTopologyRuntimeV3Peer(state)?.peerNodeId

export const selectTopologyRuntimeV3ServerConnected = (state: RootState) =>
    selectTopologyRuntimeV3Connection(state)?.serverConnectionStatus === 'CONNECTED'

export const selectTopologyDisplayMode = selectTopologyRuntimeV3DisplayMode
export const selectTopologyInstanceMode = selectTopologyRuntimeV3InstanceMode
export const selectTopologyStandalone = selectTopologyRuntimeV3Standalone
export const selectTopologyWorkspace = selectTopologyRuntimeV3Workspace
export const selectTopologySync = selectTopologyRuntimeV3Sync

const createDefaultTopologyContext = (): TopologyV3ContextState => ({
    localNodeId: 'unknown',
    displayIndex: 0,
    displayCount: 1,
    instanceMode: 'MASTER',
    displayMode: 'PRIMARY',
    workspace: 'MAIN',
    standalone: true,
    enableSlave: false,
})

export const selectTopologyRuntimeV3TcpActivationEligibility = (
    state: RootState,
    activationStatus?: TopologyV3ActivationStatus,
) => getTopologyV3TcpActivationEligibility({
    context: selectTopologyRuntimeV3Context(state) ?? createDefaultTopologyContext(),
    activationStatus,
})

export const selectTopologyRuntimeV3SwitchToSlaveEligibility = (
    state: RootState,
    activationStatus?: TopologyV3ActivationStatus,
) => getTopologyV3SwitchToSlaveEligibility({
    context: selectTopologyRuntimeV3Context(state) ?? createDefaultTopologyContext(),
    activationStatus,
})

export const selectTopologyRuntimeV3EnableSlaveEligibility = (
    state: RootState,
) => getTopologyV3EnableSlaveEligibility({
    context: selectTopologyRuntimeV3Context(state) ?? createDefaultTopologyContext(),
})

export const selectTopologyRuntimeV3DisplayModeEligibility = (
    state: RootState,
) => getTopologyV3DisplayModeEligibility({
    context: selectTopologyRuntimeV3Context(state) ?? createDefaultTopologyContext(),
})
