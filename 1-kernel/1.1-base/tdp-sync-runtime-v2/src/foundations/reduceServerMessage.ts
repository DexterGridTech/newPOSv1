import {createAppError, nowTimestampMs} from '@next/kernel-base-contracts'
import {tdpSyncV2DomainActions} from '../features/slices'
import {tdpSyncV2ErrorDefinitions} from '../supports'
import type {TdpCommandInboxItem, TdpProjectionEnvelope, TdpServerMessage} from '../types'

export interface TdpMessageSubscriptionGuardV1 {
    mode?: 'explicit' | 'legacy-all'
    acceptedTopics?: readonly string[]
    acceptedTopicSet?: ReadonlySet<string>
    reportRejectedTopic?(input: {topic: string; messageType: TdpServerMessage['type']}): void
}

export const shouldAcceptTdpProjectionTopic = (
    guard: TdpMessageSubscriptionGuardV1 | undefined,
    topic: string,
    messageType: TdpServerMessage['type'],
) => {
    if (guard?.mode !== 'explicit') {
        return true
    }
    const accepted = (guard.acceptedTopicSet ?? new Set(guard.acceptedTopics ?? [])).has(topic)
    if (!accepted) {
        guard.reportRejectedTopic?.({topic, messageType})
    }
    return accepted
}

export const filterTdpProjectionChangesBySubscription = (
    changes: readonly TdpProjectionEnvelope[],
    messageType: TdpServerMessage['type'],
    guard?: TdpMessageSubscriptionGuardV1,
) => changes.filter(change => shouldAcceptTdpProjectionTopic(guard, change.topic, messageType))

export const reduceTdpServerMessageV2 = (
    dispatchAction: (action: unknown) => void,
    message: TdpServerMessage,
    guard?: TdpMessageSubscriptionGuardV1,
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
                snapshot: filterTdpProjectionChangesBySubscription(message.data.snapshot, message.type, guard),
                highWatermark: message.data.highWatermark,
            }))
            return

        case 'CHANGESET':
            dispatchAction(tdpSyncV2DomainActions.applyChangesLoaded({
                changes: filterTdpProjectionChangesBySubscription(message.data.changes, message.type, guard),
                nextCursor: message.data.nextCursor,
                highWatermark: message.data.highWatermark,
                hasMore: message.data.hasMore,
            }))
            return

        case 'PROJECTION_CHANGED':
            if (!shouldAcceptTdpProjectionTopic(guard, message.data.change.topic, message.type)) {
                return
            }
            dispatchAction(tdpSyncV2DomainActions.applyProjectionReceived({
                cursor: message.data.cursor,
                change: message.data.change,
            }))
            return

        case 'PROJECTION_BATCH':
            dispatchAction(tdpSyncV2DomainActions.applyProjectionBatchReceived({
                changes: filterTdpProjectionChangesBySubscription(message.data.changes, message.type, guard),
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
