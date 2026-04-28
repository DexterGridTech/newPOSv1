import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {selectTdpSessionState} from '../../selectors'
import type {TdpSessionConnectionRuntimeRefV2} from '../../types'

const dispatchCursorFeedback = async (
    context: Parameters<Parameters<typeof onCommand>[1]>[0],
    cursor: number,
) => {
    await context.dispatchCommand(createCommand(
        tdpSyncV2CommandDefinitions.acknowledgeCursor,
        {cursor},
    ))
    await context.dispatchCommand(createCommand(
        tdpSyncV2CommandDefinitions.reportAppliedCursor,
        {cursor},
    ))
}

const defineActor = createModuleActorFactory(moduleName)

export const createTdpCursorFeedbackActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpCursorFeedbackActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.snapshotApplyCompleted, async context => {
            await dispatchCursorFeedback(context, context.command.payload.highWatermark)
            return {
                cursor: context.command.payload.highWatermark,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.changesApplyCompleted, async context => {
            await dispatchCursorFeedback(context, context.command.payload.nextCursor)
            return {
                cursor: context.command.payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.projectionApplyCompleted, async context => {
            await dispatchCursorFeedback(context, context.command.payload.cursor)
            return {
                cursor: context.command.payload.cursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.projectionBatchApplyCompleted, async context => {
            await dispatchCursorFeedback(context, context.command.payload.nextCursor)
            return {
                cursor: context.command.payload.nextCursor,
            }
        }),
    ],
)

export const createTdpBatchFeedbackActorDefinitionV2 = (
    connectionRuntimeRef: TdpSessionConnectionRuntimeRefV2,
): ActorDefinition => defineActor(
    'TdpBatchFeedbackActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.acknowledgeProjectionBatch, async context => {
            const sessionSubscription = selectTdpSessionState(context.getState())?.subscription
            connectionRuntimeRef.current?.sendBatchAck({
                nextCursor: context.command.payload.nextCursor,
                batchId: context.command.payload.batchId,
                processingLagMs: context.command.payload.processingLagMs,
                subscriptionHash: sessionSubscription?.hash,
            })
            return {
                nextCursor: context.command.payload.nextCursor,
                batchId: context.command.payload.batchId,
            }
        }),
    ],
)
