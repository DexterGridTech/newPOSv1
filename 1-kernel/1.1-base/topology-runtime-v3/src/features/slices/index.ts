export * from './configState'
export * from './contextState'
export * from './connectionState'
export * from './peerState'
export * from './syncState'
export * from './requestMirrorState'
export * from './demoSyncState'

import {topologyRuntimeV3ConfigStateActions, topologyRuntimeV3ConfigStateSliceDescriptor} from './configState'
import {topologyRuntimeV3ContextStateActions, topologyRuntimeV3ContextStateSliceDescriptor} from './contextState'
import {topologyRuntimeV3ConnectionStateActions, topologyRuntimeV3ConnectionStateSliceDescriptor} from './connectionState'
import {topologyRuntimeV3PeerStateActions, topologyRuntimeV3PeerStateSliceDescriptor} from './peerState'
import {topologyRuntimeV3SyncStateActions, topologyRuntimeV3SyncStateSliceDescriptor} from './syncState'
import {topologyRuntimeV3RequestMirrorStateActions, topologyRuntimeV3RequestMirrorStateSliceDescriptor} from './requestMirrorState'
import {
    topologyRuntimeV3DemoMasterStateSliceDescriptor,
    topologyRuntimeV3DemoSlaveStateSliceDescriptor,
    topologyRuntimeV3DemoSyncStateActions,
} from './demoSyncState'

export const topologyRuntimeV3StateActions = {
    ...topologyRuntimeV3ConfigStateActions,
    ...topologyRuntimeV3ContextStateActions,
    ...topologyRuntimeV3ConnectionStateActions,
    ...topologyRuntimeV3PeerStateActions,
    ...topologyRuntimeV3SyncStateActions,
    ...topologyRuntimeV3RequestMirrorStateActions,
    ...topologyRuntimeV3DemoSyncStateActions,
}

export const topologyRuntimeV3StateSlices = [
    topologyRuntimeV3ConfigStateSliceDescriptor,
    topologyRuntimeV3ContextStateSliceDescriptor,
    topologyRuntimeV3ConnectionStateSliceDescriptor,
    topologyRuntimeV3PeerStateSliceDescriptor,
    topologyRuntimeV3SyncStateSliceDescriptor,
    topologyRuntimeV3RequestMirrorStateSliceDescriptor,
    topologyRuntimeV3DemoMasterStateSliceDescriptor,
    topologyRuntimeV3DemoSlaveStateSliceDescriptor,
] as const
