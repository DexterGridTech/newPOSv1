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
import {createUiRuntimeModuleV2} from '@next/kernel-base-ui-runtime-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {moduleName} from '../moduleName'
import {runtimeReactDefaultParts} from '../foundations'
import {registerUiRendererParts} from '../foundations/rendererRegistry'
import {runtimeReactModuleManifest} from './moduleManifest'

export interface CreateRuntimeReactModuleInput {
    /**
     * Reserved for renderer-level options. Domain command bridging belongs in
     * package-specific UI bridge modules, not in the generic runtime-react layer.
     */
}

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
        actorDefinitions: [],
        preSetup: runtimeReactPreSetup,
        async install(context: RuntimeModuleContextV2) {
            void input
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: Object.values(runtimeReactDefaultParts).map(part => part.definition),
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
