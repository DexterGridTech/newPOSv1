import {createAppError, nowTimestampMs} from '@next/kernel-base-contracts'
import {tdpSyncV2DomainActions} from '../features/slices'
import {tdpSyncV2ErrorDefinitions} from '../supports'
import type {TdpCommandInboxItem, TdpServerMessage} from '../types'

export const reduceTdpServerMessageV2 = (
    dispatchAction: (action: unknown) => void,
    message: TdpServerMessage,
) => {
    /**
     * 设计意图：
     * 这里是 TDP 服务端消息进入本地 projection 仓库的唯一 reducer 边界。
     * 它只把协议消息归一化成 state action，不在这里触发业务消费，业务变化统一交给 topicChangePublisher 再广播 command。
     */
    switch (message.type) {
        case 'SESSION_READY':
            dispatchAction(tdpSyncV2DomainActions.applySessionReady({
                ...message.data,
                connectedAt: nowTimestampMs(),
            }))
            return

        case 'FULL_SNAPSHOT':
            dispatchAction(tdpSyncV2DomainActions.applySnapshotLoaded({
                snapshot: message.data.snapshot,
                highWatermark: message.data.highWatermark,
            }))
            return

        case 'CHANGESET':
            dispatchAction(tdpSyncV2DomainActions.applyChangesLoaded({
                changes: message.data.changes,
                nextCursor: message.data.nextCursor,
                highWatermark: message.data.highWatermark,
            }))
            return

        case 'PROJECTION_CHANGED':
            dispatchAction(tdpSyncV2DomainActions.applyProjectionReceived({
                cursor: message.data.cursor,
                change: message.data.change,
            }))
            return

        case 'PROJECTION_BATCH':
            dispatchAction(tdpSyncV2DomainActions.applyProjectionBatchReceived({
                changes: message.data.changes,
                nextCursor: message.data.nextCursor,
            }))
            return

        case 'COMMAND_DELIVERED':
            dispatchAction(
                tdpSyncV2DomainActions.recordCommandDelivered({
                    ...(message.data as Omit<TdpCommandInboxItem, 'receivedAt'>),
                    receivedAt: nowTimestampMs(),
                }),
            )
            return

        case 'PONG':
            dispatchAction(tdpSyncV2DomainActions.applyPongReceived(message.data))
            return

        case 'EDGE_DEGRADED':
            dispatchAction(tdpSyncV2DomainActions.applyEdgeDegraded(message.data))
            return

        case 'SESSION_REHOME_REQUIRED':
            dispatchAction(tdpSyncV2DomainActions.applySessionRehomeRequired(message.data))
            return

        case 'ERROR':
            dispatchAction(
                tdpSyncV2DomainActions.applyProtocolFailed(createAppError(tdpSyncV2ErrorDefinitions.protocolError, {
                    args: {error: message.error.message},
                    details: message.error,
                })),
            )
            return
    }
}
