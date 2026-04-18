import {AUTOMATION_PROTOCOL_VERSION} from '../foundations/protocol'
import {
    type AutomationTargetRegistration,
    createAutomationTargetRegistry,
} from '../foundations/targetRegistry'
import type {SessionHelloResult} from '../types/runtime'

export interface CreateAutomationRuntimeOptions {
    readonly buildProfile: 'debug' | 'internal' | 'product' | 'test'
    readonly scriptExecutionAvailable?: boolean
}

export interface AutomationRuntime {
    hello(): SessionHelloResult
    registerTarget(input: AutomationTargetRegistration): () => void
}

export const createAutomationRuntime = (
    options: CreateAutomationRuntimeOptions,
): AutomationRuntime => {
    const targetRegistry = createAutomationTargetRegistry()
    const productMode = options.buildProfile === 'product'

    return {
        hello() {
            return {
                protocolVersion: AUTOMATION_PROTOCOL_VERSION,
                capabilities: [
                    'runtime.query',
                    'ui.semanticRegistry',
                    'wait',
                    'trace',
                    ...(productMode || !options.scriptExecutionAvailable ? [] : ['scripts.execute']),
                ],
                availableTargets: targetRegistry.list().map(target => target.target),
                buildProfile: options.buildProfile,
                productMode,
                scriptExecutionAvailable: !productMode && options.scriptExecutionAvailable === true,
            }
        },
        registerTarget(input) {
            if (productMode) {
                return () => {}
            }
            return targetRegistry.register(input)
        },
    }
}
