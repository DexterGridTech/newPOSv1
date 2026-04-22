import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
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
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {moduleName} from '../moduleName'
import {runtimeReactDefaultParts} from '../foundations'
import {registerUiRendererParts} from '../foundations/rendererRegistry'
import {runtimeReactModuleManifest} from './moduleManifest'

const defineActor = createModuleActorFactory(moduleName)

export interface RuntimeReactPowerDisplaySwitchAlertCopy {
    primaryTitle: string
    secondaryTitle: string
    message: string
    confirmText: string
    cancelText: string
    autoConfirmAfterMs?: number
}

export interface CreateRuntimeReactModuleInput {
    powerDisplaySwitchAlert?: RuntimeReactPowerDisplaySwitchAlertCopy
}

const defaultPowerDisplaySwitchAlertCopy: RuntimeReactPowerDisplaySwitchAlertCopy = {
    primaryTitle: '切换到主屏',
    secondaryTitle: '切换到副屏',
    message: '检测到电源状态变化，请确认是否切换显示模式。',
    confirmText: '立即切换',
    cancelText: '取消',
    autoConfirmAfterMs: 3_000,
}

const createRuntimeReactPowerDisplaySwitchActor = (
    input: CreateRuntimeReactModuleInput = {},
) => defineActor('RuntimeReactPowerDisplaySwitchActor', [
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

export const runtimeReactPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(runtimeReactDefaultParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (input: CreateRuntimeReactModuleInput = {}): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...runtimeReactModuleManifest,
        dependencies: [{moduleName: createUiRuntimeModuleV2().moduleName}],
        actorDefinitions: [createRuntimeReactPowerDisplaySwitchActor(input)],
        preSetup: runtimeReactPreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: Object.values(runtimeReactDefaultParts).map(part => part.definition),
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
