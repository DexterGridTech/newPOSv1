import type {KernelRuntimeAppV2, KernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import {createAutomationRequestDispatcher, type AssemblyAutomationController} from './createAutomationRequestDispatcher'
import {createRuntimeReactAutomationBridge} from './createRuntimeReactAutomationBridge'

export interface CreateAssemblyAutomationOptions {
    readonly app: KernelRuntimeAppV2
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly automationEnabled: boolean
    readonly scriptExecutionAvailable?: boolean
}

export interface AssemblyAutomationRuntime {
    readonly controller: AssemblyAutomationController
    readonly runtimeReactBridge: ReturnType<typeof createRuntimeReactAutomationBridge>
    attachRuntime(target: 'primary' | 'secondary', runtime: KernelRuntimeV2): () => void
    dispose(): void
}

export const createAssemblyAutomation = (
    options: CreateAssemblyAutomationOptions,
): AssemblyAutomationRuntime => {
    let runtimeReactBridge: ReturnType<typeof createRuntimeReactAutomationBridge> | undefined
    const controller = createAutomationRequestDispatcher({
        app: options.app,
        buildProfile: options.buildProfile,
        automationEnabled: options.automationEnabled,
        scriptExecutionAvailable: options.scriptExecutionAvailable,
        performNodeAction: action => runtimeReactBridge?.performNodeAction(action),
    })
    runtimeReactBridge = createRuntimeReactAutomationBridge(controller.registry)

    return {
        controller,
        runtimeReactBridge,
        attachRuntime(target, runtime) {
            return controller.attachRuntime({
                target,
                runtimeId: runtime.runtimeId,
                runtime,
            })
        },
        dispose() {
            controller.dispose()
        },
    }
}
