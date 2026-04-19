import {
    createModuleActorFactory,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTcpIsActivated, selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {replaceRetailShellRootScreen} from '../../supports/rootScreenRouter'
import {moduleName} from '../../moduleName'

const defineActor = createModuleActorFactory(moduleName)

export const createRetailShellRuntimeInitializeActorDefinition = (): ActorDefinition =>
    defineActor('RetailShellRuntimeInitializeActor', [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            const state = context.getState()
            await replaceRetailShellRootScreen(context, {
                activated: selectTcpIsActivated(state),
                terminalId: selectTcpTerminalId(state) ?? undefined,
                source: `${moduleName}.initialize`,
            })
            return {
                displayIndex: context.displayContext.displayIndex ?? 0,
                activated: selectTcpIsActivated(state),
            }
        }),
    ])
