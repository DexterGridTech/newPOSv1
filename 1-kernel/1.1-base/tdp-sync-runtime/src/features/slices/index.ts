export * from './tdpSession'
export * from './tdpSync'
export * from './tdpProjection'
export * from './tdpCommandInbox'
export * from './tdpControlSignals'

import {tdpCommandInboxActions, tdpCommandInboxSliceDescriptor} from './tdpCommandInbox'
import {tdpControlSignalsActions, tdpControlSignalsSliceDescriptor} from './tdpControlSignals'
import {tdpProjectionActions, tdpProjectionSliceDescriptor} from './tdpProjection'
import {tdpSessionActions, tdpSessionSliceDescriptor} from './tdpSession'
import {tdpSyncActions, tdpSyncSliceDescriptor} from './tdpSync'

export const tdpSyncStateActions = {
    ...tdpSessionActions,
    ...tdpSyncActions,
    ...tdpProjectionActions,
    ...tdpCommandInboxActions,
    ...tdpControlSignalsActions,
}

export const tdpSyncStateSlices = [
    tdpSessionSliceDescriptor,
    tdpSyncSliceDescriptor,
    tdpProjectionSliceDescriptor,
    tdpCommandInboxSliceDescriptor,
    tdpControlSignalsSliceDescriptor,
]
