import {createCommand, type CommandIntent} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {runtimeReactDefaultParts} from '@impos2/ui-base-runtime-react'

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

export const ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID = 'assembly.topology.power-display-switch-confirm'

const createPowerDisplaySwitchCommands = (displayMode: 'PRIMARY' | 'SECONDARY') => ([
    createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
        overlayId: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
    }),
    createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
        displayMode,
    }),
]) as const

const createPowerDisplaySwitchCancelCommands = () => ([
    createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
        overlayId: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
    }),
]) as const

const openPowerDisplaySwitchAlert = async (input: {
    displayMode: 'PRIMARY' | 'SECONDARY'
    dispatchCommand(command: CommandIntent): Promise<unknown> | unknown
}) => {
    const isPrimary = input.displayMode === 'PRIMARY'
    await input.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.openOverlay, {
        definition: runtimeReactDefaultParts.defaultAlert.definition,
        id: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
        props: {
            title: isPrimary ? '切换到主屏' : '切换到副屏',
            message: '检测到电源状态变化，请确认是否切换显示模式。',
            confirmText: '立即切换',
            cancelText: '取消',
            confirmAction: {
                commands: createPowerDisplaySwitchCommands(input.displayMode),
            },
            cancelAction: {
                commands: createPowerDisplaySwitchCancelCommands(),
            },
            metadata: {
                reason: 'power-status-change',
                targetDisplayMode: input.displayMode,
            },
        },
    }))
}

export const handleAssemblyPowerDisplaySwitch = async (
    input: HandleAssemblyPowerDisplaySwitchInput,
): Promise<void> => {
    const {context, powerConnected, dispatchCommand} = input
    if (context?.standalone !== true || context.instanceMode !== 'SLAVE') {
        return
    }

    if (powerConnected && context.displayMode === 'PRIMARY') {
        await openPowerDisplaySwitchAlert({
            displayMode: 'SECONDARY',
            dispatchCommand,
        })
        return
    }

    if (!powerConnected && context.displayMode === 'SECONDARY') {
        await openPowerDisplaySwitchAlert({
            displayMode: 'PRIMARY',
            dispatchCommand,
        })
    }
}
