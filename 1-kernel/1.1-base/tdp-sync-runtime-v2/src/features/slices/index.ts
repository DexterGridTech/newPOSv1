export * from './domainActions'
export * from './tdpSession'
export * from './tdpSync'
export * from './tdpProjection'
export * from './tdpCommandInbox'
export * from './tdpControlSignals'

import {tdpCommandInboxV2Actions, tdpCommandInboxV2SliceDescriptor} from './tdpCommandInbox'
import {tdpControlSignalsV2Actions, tdpControlSignalsV2SliceDescriptor} from './tdpControlSignals'
import {tdpProjectionV2Actions, tdpProjectionV2SliceDescriptor} from './tdpProjection'
import {tdpSessionV2Actions, tdpSessionV2SliceDescriptor} from './tdpSession'
import {tdpSyncV2Actions, tdpSyncV2SliceDescriptor} from './tdpSync'

export const tdpSyncV2StateActions = {
    ...tdpSessionV2Actions,
    ...tdpSyncV2Actions,
    ...tdpProjectionV2Actions,
    ...tdpCommandInboxV2Actions,
    ...tdpControlSignalsV2Actions,
}

export const tdpSyncV2StateSlices = [
    tdpSessionV2SliceDescriptor,
    tdpSyncV2SliceDescriptor,
    tdpProjectionV2SliceDescriptor,
    tdpCommandInboxV2SliceDescriptor,
    tdpControlSignalsV2SliceDescriptor,
] as const
