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

export const createTdpBootstrapActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpBootstrapActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSync, async context => {
            context.dispatchAction(tdpSyncV2DomainActions.bootstrapResetRuntime())

            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSyncSucceeded, {}))
            return {
                lastCursor: (context.getState() as any)?.[`${moduleName}.sync`]?.lastCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSyncSucceeded, () => {
            return {}
        }),
    ],
)
