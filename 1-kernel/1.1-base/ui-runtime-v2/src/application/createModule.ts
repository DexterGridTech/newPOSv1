import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {getUiScreenRegistry} from '../selectors'
import {createUiRuntimeActorDefinitions} from '../features/actors'
import {uiRuntimeV2ModuleManifest} from './moduleManifest'

export const uiRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createUiRuntimeModuleV2 = (): KernelRuntimeModuleV2 => {
    const registry = getUiScreenRegistry()

    return defineKernelRuntimeModuleV2({
        ...uiRuntimeV2ModuleManifest,
        actorDefinitions: createUiRuntimeActorDefinitions(registry),
        preSetup: uiRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: uiRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: uiRuntimeV2ModuleManifest.commandNames,
            })
        },
    })
}

export const uiRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createUiRuntimeModuleV2)
