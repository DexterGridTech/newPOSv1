import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

const createDisconnectCommand = () => createCommand(
    tdpSyncV2CommandDefinitions.disconnectTdpSession,
    {},
)

export const createTdpAutoConnectActorDefinitionV2 = (
    input: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition => defineActor(
    'TdpAutoConnectActor',
    [
        onCommand(tcpControlV2CommandDefinitions.activateTerminalSucceeded, async context => {
            if (input.autoConnectOnActivation === false) {
                return {}
            }
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}))
            return {}
        }),
        onCommand(tcpControlV2CommandDefinitions.deactivateTerminalSucceeded, async context => {
            await context.dispatchCommand(createDisconnectCommand())
            return {}
        }),
        onCommand(tcpControlV2CommandDefinitions.resetTcpControl, async context => {
            await context.dispatchCommand(createDisconnectCommand())
            return {}
        }),
    ],
)
