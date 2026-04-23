import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'

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
        onCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, async context => {
            await dispatchCursorFeedback(context, context.command.payload.highWatermark)
            return {
                cursor: context.command.payload.highWatermark,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, async context => {
            await dispatchCursorFeedback(context, context.command.payload.nextCursor)
            return {
                cursor: context.command.payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, async context => {
            await dispatchCursorFeedback(context, context.command.payload.cursor)
            return {
                cursor: context.command.payload.cursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, async context => {
            await dispatchCursorFeedback(context, context.command.payload.nextCursor)
            return {
                cursor: context.command.payload.nextCursor,
            }
        }),
    ],
)
