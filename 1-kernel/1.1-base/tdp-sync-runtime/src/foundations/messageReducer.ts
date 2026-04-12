import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import {tdpSyncStateActions} from '../features/slices'
import {tdpSyncErrorDefinitions} from '../supports'
import type {TdpCommandInboxItem, TdpServerMessage} from '../types'

export const reduceTdpServerMessage = (
    dispatchAction: (action: unknown) => void,
    message: TdpServerMessage,
) => {
    switch (message.type) {
        case 'SESSION_READY':
            dispatchAction(
                tdpSyncStateActions.setReady({
                    ...message.data,
                    connectedAt: nowTimestampMs(),
                }),
            )
            dispatchAction(tdpSyncStateActions.setStatus('READY'))
            return

        case 'FULL_SNAPSHOT':
            dispatchAction(tdpSyncStateActions.replaceSnapshot(message.data.snapshot))
            dispatchAction(tdpSyncStateActions.setSnapshotStatus('ready'))
            dispatchAction(tdpSyncStateActions.setLastCursor(message.data.highWatermark))
            return

        case 'CHANGESET':
            message.data.changes.forEach(change => {
                dispatchAction(tdpSyncStateActions.applyProjection(change))
            })
            dispatchAction(tdpSyncStateActions.setChangesStatus('ready'))
            dispatchAction(tdpSyncStateActions.setLastCursor(message.data.nextCursor))
            return

        case 'PROJECTION_CHANGED':
            dispatchAction(tdpSyncStateActions.applyProjection(message.data.change))
            dispatchAction(tdpSyncStateActions.setLastDeliveredCursor(message.data.cursor))
            dispatchAction(tdpSyncStateActions.setLastCursor(message.data.cursor))
            return

        case 'PROJECTION_BATCH':
            message.data.changes.forEach(change => {
                dispatchAction(tdpSyncStateActions.applyProjection(change))
            })
            dispatchAction(tdpSyncStateActions.setLastDeliveredCursor(message.data.nextCursor))
            dispatchAction(tdpSyncStateActions.setLastCursor(message.data.nextCursor))
            return

        case 'COMMAND_DELIVERED':
            dispatchAction(
                tdpSyncStateActions.pushCommand({
                    ...(message.data as Omit<TdpCommandInboxItem, 'receivedAt'>),
                    receivedAt: nowTimestampMs(),
                }),
            )
            return

        case 'PONG':
            dispatchAction(tdpSyncStateActions.setLastPongAt(message.data.timestamp))
            return

        case 'EDGE_DEGRADED':
            dispatchAction(tdpSyncStateActions.setStatus('DEGRADED'))
            dispatchAction(tdpSyncStateActions.setNodeState(message.data.nodeState))
            dispatchAction(tdpSyncStateActions.setAlternativeEndpoints(message.data.alternativeEndpoints))
            dispatchAction(tdpSyncStateActions.setLastEdgeDegraded(message.data))
            return

        case 'SESSION_REHOME_REQUIRED':
            dispatchAction(tdpSyncStateActions.setStatus('REHOME_REQUIRED'))
            dispatchAction(tdpSyncStateActions.setAlternativeEndpoints(message.data.alternativeEndpoints))
            dispatchAction(tdpSyncStateActions.setLastRehomeRequired(message.data))
            return

        case 'ERROR':
            dispatchAction(
                tdpSyncStateActions.setLastProtocolError(
                    createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {error: message.error.message},
                        details: message.error,
                    }),
                ),
            )
            dispatchAction(tdpSyncStateActions.setStatus('ERROR'))
            return
    }
}
