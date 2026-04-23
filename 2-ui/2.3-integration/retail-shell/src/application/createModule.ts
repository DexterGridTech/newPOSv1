import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {
    moduleName as runtimeReactModuleName,
    registerUiRendererParts,
} from '@impos2/ui-base-runtime-react'
import {moduleName as inputRuntimeModuleName} from '@impos2/ui-base-input-runtime'
import {moduleName as adminConsoleModuleName} from '@impos2/ui-base-admin-console'
import {moduleName as terminalConsoleModuleName} from '@impos2/ui-base-terminal-console'
import {moduleName as masterDataWorkbenchModuleName} from '@impos2/ui-business-catering-master-data-workbench'
import {moduleName} from '../moduleName'
import {createRetailShellActorDefinitions} from '../features'
import {retailShellScreenDefinitions, retailShellScreenParts} from '../foundations'
import {retailShellModuleManifest} from './moduleManifest'

export const retailShellPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(retailShellScreenParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...retailShellModuleManifest,
        dependencies: [
            {moduleName: 'kernel.base.ui-runtime-v2'},
            {moduleName: 'kernel.base.tcp-control-runtime-v2'},
            {moduleName: runtimeReactModuleName},
            {moduleName: inputRuntimeModuleName},
            {moduleName: adminConsoleModuleName},
            {moduleName: terminalConsoleModuleName},
            {moduleName: masterDataWorkbenchModuleName},
        ],
        actorDefinitions: createRetailShellActorDefinitions(),
        preSetup: retailShellPreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: retailShellScreenDefinitions,
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
