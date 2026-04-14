import {createCommand, onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTdpSyncState} from '../../selectors'
import {tdpSyncV2CommandDefinitions} from '../commands'

export const createTdpCommandAckActorDefinitionV2 = (): ActorDefinition => ({
    moduleName,
    actorName: 'TdpCommandAckActor',
    handlers: [
        onCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, async context => {
            const resolvedCursor = selectTdpSyncState(context.getState())?.lastCursor ?? 0
            await context.dispatchCommand(createCommand(
                tdpSyncV2CommandDefinitions.acknowledgeCursor,
                {
                    cursor: resolvedCursor,
                    topic: context.command.payload.topic,
                    itemKey: context.command.payload.commandId,
                    instanceId: typeof context.command.payload.payload.instanceId === 'string'
                        ? context.command.payload.payload.instanceId
                        : undefined,
                },
            ))
            return {
                cursor: resolvedCursor,
            }
        }),
    ],
})
