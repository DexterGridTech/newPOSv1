import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {registerUiRendererParts} from '@next/ui-base-runtime-react'
import {moduleName} from '../moduleName'
import {
    terminalConsoleScreenDefinitions,
    terminalConsoleScreenParts,
} from '../foundations/terminalScreenParts'
import {terminalConsoleModuleManifest} from './moduleManifest'

export const terminalConsolePreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(terminalConsoleScreenParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...terminalConsoleModuleManifest,
        preSetup: terminalConsolePreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: terminalConsoleScreenDefinitions,
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
