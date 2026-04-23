import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {replaceRetailShellRootScreen} from '../../supports/rootScreenRouter'
import {moduleName} from '../../moduleName'

const defineActor = createModuleActorFactory(moduleName)

export const createRetailShellTcpLifecycleActorDefinition = (): ActorDefinition =>
    defineActor('RetailShellTcpLifecycleActor', [
        onCommand(tcpControlV2CommandDefinitions.activateTerminalSucceeded, async context => {
            await replaceRetailShellRootScreen(context, {
                activated: true,
                terminalId: context.command.payload.terminalId,
                source: `${moduleName}.activateTerminalSucceeded`,
            })
            return {}
        }),
        onCommand(tcpControlV2CommandDefinitions.deactivateTerminalSucceeded, async context => {
            await replaceRetailShellRootScreen(context, {
                activated: false,
                source: `${moduleName}.deactivateTerminalSucceeded`,
            })
            return {}
        }),
        onCommand(tcpControlV2CommandDefinitions.resetTcpControl, async context => {
            await replaceRetailShellRootScreen(context, {
                activated: false,
                source: `${moduleName}.resetTcpControl`,
            })
            return {}
        }),
    ])
