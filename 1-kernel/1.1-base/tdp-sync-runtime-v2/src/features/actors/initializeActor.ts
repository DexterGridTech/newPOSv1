import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpInitializeActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpInitializeActor',
    [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSync, {}))
            return {}
        }),
    ],
)
