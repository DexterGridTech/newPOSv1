import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {getUiScreenRegistry} from '../selectors'
import {createUiRuntimeActorDefinitions} from '../features/actors'
import {uiRuntimeV2ModuleManifest} from './moduleManifest'

/**
 * 设计意图：
 * ui-runtime-v2 模块本身保持很薄，只负责把 registry、state slice 和 actor 接入 runtime-shell。
 * screen 定义与渲染选择留在 registry/selector 层，避免 UI 基础包重新退化成重职责导航中心。
 */
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
