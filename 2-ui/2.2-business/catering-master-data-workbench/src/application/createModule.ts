import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {registerUiRendererParts} from '@next/ui-base-runtime-react'
import {moduleName} from '../moduleName'
import {
    masterDataWorkbenchScreenDefinitions,
    masterDataWorkbenchScreenParts,
} from '../foundations'
import {masterDataWorkbenchModuleManifest} from './moduleManifest'

export const masterDataWorkbenchPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(masterDataWorkbenchScreenParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...masterDataWorkbenchModuleManifest,
        preSetup: masterDataWorkbenchPreSetup,
        async install(context: RuntimeModuleContextV2) {
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: masterDataWorkbenchScreenDefinitions,
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })

export const masterDataWorkbenchModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(createModule)
