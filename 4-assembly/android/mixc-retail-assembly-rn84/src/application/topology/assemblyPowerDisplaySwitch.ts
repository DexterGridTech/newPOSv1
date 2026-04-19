import {createCommand, type CommandIntent} from '@impos2/kernel-base-runtime-shell-v2'
import {
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'

export interface AssemblyPowerDisplaySwitchContext {
    standalone?: boolean
    instanceMode?: string
    displayMode?: string
}

export interface HandleAssemblyPowerDisplaySwitchInput {
    context?: AssemblyPowerDisplaySwitchContext | null
    powerConnected: boolean
    dispatchCommand(command: CommandIntent): Promise<unknown> | unknown
}

export const handleAssemblyPowerDisplaySwitch = async (
    input: HandleAssemblyPowerDisplaySwitchInput,
): Promise<void> => {
    const {context, powerConnected, dispatchCommand} = input
    if (context?.standalone !== true || context.instanceMode !== 'SLAVE') {
        return
    }

    if (powerConnected && context.displayMode === 'PRIMARY') {
        await dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
        return
    }

    if (!powerConnected && context.displayMode === 'SECONDARY') {
        await dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'PRIMARY'},
        ))
    }
}
