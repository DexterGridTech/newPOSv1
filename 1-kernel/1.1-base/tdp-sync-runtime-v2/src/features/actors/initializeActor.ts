import {createCommand, onCommand, runtimeShellV2CommandDefinitions, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'

export const createTdpInitializeActorDefinitionV2 = (): ActorDefinition => ({
    moduleName,
    actorName: 'TdpInitializeActor',
    handlers: [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSync, {}))
            return {}
        }),
    ],
})
