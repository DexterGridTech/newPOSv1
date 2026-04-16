import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import {moduleName} from '../moduleName'
import {runtimeReactDefaultParts} from '../foundations'
import {registerUiRendererParts} from '../foundations/rendererRegistry'
import {runtimeReactModuleManifest} from './moduleManifest'

export const runtimeReactPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(runtimeReactDefaultParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...runtimeReactModuleManifest,
        dependencies: [{moduleName: createUiRuntimeModuleV2().moduleName}],
        preSetup: runtimeReactPreSetup,
        install(context: RuntimeModuleContextV2) {
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
