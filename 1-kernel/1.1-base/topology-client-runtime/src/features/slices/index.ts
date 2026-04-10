/**
 * Local state slices or reducers for this package belong here.
 */
export * from './contextState'
export * from './connectionState'
export * from './peerState'
export * from './syncState'

import {topologyClientContextActions, topologyClientContextSliceDescriptor} from './contextState'
import {topologyClientConnectionActions, topologyClientConnectionSliceDescriptor} from './connectionState'
import {topologyClientPeerActions, topologyClientPeerSliceDescriptor} from './peerState'
import {topologyClientSyncActions, topologyClientSyncSliceDescriptor} from './syncState'

export const topologyClientStateActions = {
    ...topologyClientContextActions,
    ...topologyClientConnectionActions,
    ...topologyClientPeerActions,
    ...topologyClientSyncActions,
}

export const topologyClientStateSlices = [
    topologyClientContextSliceDescriptor,
    topologyClientConnectionSliceDescriptor,
    topologyClientPeerSliceDescriptor,
    topologyClientSyncSliceDescriptor,
]
