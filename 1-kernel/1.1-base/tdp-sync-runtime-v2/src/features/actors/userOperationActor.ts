import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpHotUpdateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpUserOperationActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpUserOperationActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.recordUserOperation, context => {
            context.dispatchAction(tdpHotUpdateActions.recordUserOperation({
                at: context.command.payload.at,
            }))
            return {recordedAt: context.command.payload.at ?? Date.now()}
        }),
    ],
)
