import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTdpSyncState} from '../../selectors'
import {tdpSyncV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpCommandAckActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpCommandAckActor',
    [
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
)
