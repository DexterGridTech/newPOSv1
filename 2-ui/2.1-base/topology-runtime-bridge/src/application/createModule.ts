import type {
    KernelRuntimeModuleV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createModuleActorFactory,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    onCommand,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {createUiRuntimeModuleV2, uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {runtimeReactDefaultParts} from '@impos2/ui-base-runtime-react'
import {moduleName} from '../moduleName'
import {topologyRuntimeBridgeModuleManifest} from './moduleManifest'
import type {CreateTopologyRuntimeBridgeModuleInput, TopologyPowerDisplaySwitchAlertCopy} from '../types'

const defineActor = createModuleActorFactory(moduleName)

const defaultPowerDisplaySwitchAlertCopy: TopologyPowerDisplaySwitchAlertCopy = {
    primaryTitle: '切换到主屏',
    secondaryTitle: '切换到副屏',
    message: '检测到电源状态变化，请确认是否切换显示模式。',
    confirmText: '立即切换',
    cancelText: '取消',
    autoConfirmAfterMs: 3_000,
}

const createTopologyPowerDisplaySwitchBridgeActor = (
    input: CreateTopologyRuntimeBridgeModuleInput = {},
) => defineActor('TopologyPowerDisplaySwitchBridgeActor', [
    onCommand(topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation, async context => {
        const alertCopy = input.powerDisplaySwitchAlert ?? defaultPowerDisplaySwitchAlertCopy
        const isPrimary = context.command.payload.displayMode === 'PRIMARY'
        await context.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.openOverlay,
            {
                definition: runtimeReactDefaultParts.defaultAlert.definition,
                id: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
                props: {
                    title: isPrimary ? alertCopy.primaryTitle : alertCopy.secondaryTitle,
                    message: alertCopy.message,
                    autoConfirmAfterMs: alertCopy.autoConfirmAfterMs,
                    confirmText: alertCopy.confirmText,
                    cancelText: alertCopy.cancelText,
                    confirmAction: {
                        commands: [
                            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                                overlayId: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
                            }),
                            createCommand(topologyRuntimeV3CommandDefinitions.confirmPowerDisplayModeSwitch, {
                                displayMode: context.command.payload.displayMode,
                            }),
                        ],
                    },
                    cancelAction: {
                        commands: [
                            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                                overlayId: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
                            }),
                        ],
                    },
                    metadata: {
                        reason: context.command.payload.reason,
                        targetDisplayMode: context.command.payload.displayMode,
                        powerConnected: context.command.payload.powerConnected,
                    },
                },
            },
        ))
    }),
])

export const topologyRuntimeBridgePreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (
    input: CreateTopologyRuntimeBridgeModuleInput = {},
): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...topologyRuntimeBridgeModuleManifest,
        dependencies: [{moduleName: createUiRuntimeModuleV2().moduleName}],
        actorDefinitions: [createTopologyPowerDisplaySwitchBridgeActor(input)],
        preSetup: topologyRuntimeBridgePreSetup,
    })
