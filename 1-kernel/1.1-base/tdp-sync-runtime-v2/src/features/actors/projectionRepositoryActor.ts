import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpProjectionRepositoryActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpProjectionRepositoryActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applySnapshotLoaded(payload))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            return {
                count: payload.snapshot.length,
                highWatermark: payload.highWatermark,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyChangesLoaded(payload))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            return {
                count: payload.changes.length,
                nextCursor: payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyProjectionReceived(payload))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            return {
                cursor: payload.cursor,
                topic: payload.change.topic,
                itemKey: payload.change.itemKey,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, async context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyProjectionBatchReceived(payload))
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, {}))
            return {
                count: payload.changes.length,
                nextCursor: payload.nextCursor,
            }
        }),
    ],
)
