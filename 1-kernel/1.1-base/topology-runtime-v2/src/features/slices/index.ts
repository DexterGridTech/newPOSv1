export * from './recoveryState'
export * from './contextState'
export * from './connectionState'
export * from './peerState'
export * from './syncState'

import {topologyRuntimeV2RecoveryStateActions, topologyRuntimeV2RecoveryStateSliceDescriptor} from './recoveryState'
import {topologyRuntimeV2ContextStateActions, topologyRuntimeV2ContextStateSliceDescriptor} from './contextState'
import {topologyRuntimeV2ConnectionStateActions, topologyRuntimeV2ConnectionStateSliceDescriptor} from './connectionState'
import {topologyRuntimeV2PeerStateActions, topologyRuntimeV2PeerStateSliceDescriptor} from './peerState'
import {topologyRuntimeV2SyncStateActions, topologyRuntimeV2SyncStateSliceDescriptor} from './syncState'

export const topologyRuntimeV2StateActions = {
    ...topologyRuntimeV2RecoveryStateActions,
    ...topologyRuntimeV2ContextStateActions,
    ...topologyRuntimeV2ConnectionStateActions,
    ...topologyRuntimeV2PeerStateActions,
    ...topologyRuntimeV2SyncStateActions,
}

export const topologyRuntimeV2StateSlices = [
    topologyRuntimeV2RecoveryStateSliceDescriptor,
    topologyRuntimeV2ContextStateSliceDescriptor,
    topologyRuntimeV2ConnectionStateSliceDescriptor,
    topologyRuntimeV2PeerStateSliceDescriptor,
    topologyRuntimeV2SyncStateSliceDescriptor,
] as const
