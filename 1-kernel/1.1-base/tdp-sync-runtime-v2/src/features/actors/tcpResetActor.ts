import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@next/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2StateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

/**
 * 设计意图：
 * `resetTcpControl` 表示当前 terminal binding 被显式清空，后续重新激活应视为新的
 * TDP identity，而不是普通应用重启恢复。因此这里定向清理 TDP cursor、本地
 * projection repository、会话态与 topic-control 辅助状态，让下一次激活强制走
 * full snapshot 重建。
 */
export const createTdpTcpResetActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpTcpResetActor',
    [
        onCommand(tcpControlV2CommandDefinitions.resetTcpControl, context => {
            context.dispatchAction(tdpSyncV2StateActions.resetSession())
            context.dispatchAction(tdpSyncV2StateActions.resetRuntimeState())
            context.dispatchAction(tdpSyncV2StateActions.resetProjection())
            context.dispatchAction(tdpSyncV2StateActions.resetCommandInbox())
            context.dispatchAction(tdpSyncV2StateActions.setLastProtocolError(null))
            context.dispatchAction(tdpSyncV2StateActions.setLastEdgeDegraded(null))
            context.dispatchAction(tdpSyncV2StateActions.setLastRehomeRequired(null))
            context.dispatchAction(tdpSyncV2StateActions.setLastDisconnectReason(null))
            context.dispatchAction(tdpSyncV2StateActions.setLastCursor(undefined))
            context.dispatchAction(tdpSyncV2StateActions.setLastDeliveredCursor(undefined))
            context.dispatchAction(tdpSyncV2StateActions.setLastAckedCursor(undefined))
            context.dispatchAction(tdpSyncV2StateActions.setLastAppliedCursor(undefined))
            return {
                reset: true,
                scope: `${moduleName}.tcp-reset`,
            }
        }),
    ],
)
