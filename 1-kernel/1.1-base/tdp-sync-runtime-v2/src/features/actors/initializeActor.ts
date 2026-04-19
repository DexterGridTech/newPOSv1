import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTcpIsActivated} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../../types'
import {tdpSyncV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpInitializeActorDefinitionV2 = (
    input: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition => defineActor(
    'TdpInitializeActor',
    [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSync, {}))
            if (input.autoConnectOnActivation !== false && selectTcpIsActivated(context.getState())) {
                await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}))
            }
            return {}
        }),
    ],
)
