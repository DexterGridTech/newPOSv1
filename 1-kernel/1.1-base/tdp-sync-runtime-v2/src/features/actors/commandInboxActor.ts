import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpCommandInboxActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpCommandInboxActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, context => {
            context.dispatchAction(tdpSyncV2DomainActions.recordCommandDelivered({
                ...context.command.payload,
                receivedAt: nowTimestampMs(),
            }))
            return {}
        }),
    ],
)
