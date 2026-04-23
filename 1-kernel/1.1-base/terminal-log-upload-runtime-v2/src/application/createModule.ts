import type {
    KernelRuntimeModuleV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {createTerminalLogUploadActorDefinitionsV2} from '../features/actors'
import {terminalLogUploadRuntimeV2ModuleManifest} from './moduleManifest'

export const terminalLogUploadRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTerminalLogUploadRuntimeModuleV2 = (): KernelRuntimeModuleV2 => {
    return defineKernelRuntimeModuleV2({
        ...terminalLogUploadRuntimeV2ModuleManifest,
        actorDefinitions: createTerminalLogUploadActorDefinitionsV2(),
        preSetup: terminalLogUploadRuntimeV2PreSetup,
    })
}

export const terminalLogUploadRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTerminalLogUploadRuntimeModuleV2)
