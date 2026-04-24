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
import {createWorkflowActorDefinitionsV2} from '../features/actors'
import type {CreateWorkflowRuntimeModuleV2Input} from '../types'
import {createWorkflowEngineV2} from '../foundations/engine'
import {createWorkflowBuiltinTaskDefinitions} from '../foundations/builtinTasks'
import type {WorkflowRuntimeRegistryRecord} from '../foundations/runtime'
import {workflowRuntimeV2ModuleManifest} from './moduleManifest'

export const DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC_V2 = 'kernel.workflow.definition'

/**
 * 设计意图：
 * workflow 模块安装时创建单个 engine，并把 run/register/remove/cancel 能力通过 registry 暴露给 actor 和宿主。
 * remote topic 只是定义输入来源之一，不是另一个真相源；真正生效定义仍统一进入 workflowDefinitions state。
 */
export const workflowRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createWorkflowRuntimeModuleV2 = (
    input: CreateWorkflowRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const registry: WorkflowRuntimeRegistryRecord = {}
    const remoteDefinitionTopicKey =
        input.remoteDefinitionTopicKey ?? DEFAULT_REMOTE_WORKFLOW_DEFINITION_TOPIC_V2

    return defineKernelRuntimeModuleV2({
        ...workflowRuntimeV2ModuleManifest,
        actorDefinitions: createWorkflowActorDefinitionsV2(registry, remoteDefinitionTopicKey),
        preSetup: workflowRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            const engine = createWorkflowEngineV2({
                context,
                registry,
                runtimePlatform: input.runtimePlatform,
            })
            registry.runtime = engine.runtime
            registry.runFromCommand = engine.runFromCommand
            registry.registerDefinitions = inputValue => {
                void engine.runtime.registerDefinitions(inputValue)
            }
            registry.removeDefinition = inputValue => {
                void engine.runtime.removeDefinition(inputValue)
            }
            registry.cancel = inputValue => {
                engine.runtime.cancel(inputValue)
            }

            engine.registerDefinitions([
                ...createWorkflowBuiltinTaskDefinitions(),
                ...(input.initialDefinitions ?? []),
            ], 'module')

            input.onRuntimeReady?.(engine.runtime)

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: workflowRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: workflowRuntimeV2ModuleManifest.commandNames,
                remoteDefinitionTopicKey,
            })
        },
    })
}

export const workflowRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createWorkflowRuntimeModuleV2)
