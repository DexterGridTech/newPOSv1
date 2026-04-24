import type {
    RuntimeReactAutomationActionInput,
    RuntimeReactAutomationBridge,
    RuntimeReactAutomationNodeRegistration,
} from '@next/ui-base-runtime-react'
import type {SemanticRegistry} from '@next/ui-base-automation-runtime'

export interface RuntimeReactAutomationBridgeWithActions extends RuntimeReactAutomationBridge {
    performNodeAction(input: RuntimeReactAutomationActionInput): Promise<unknown>
}

export const createRuntimeReactAutomationBridge = (
    registry: SemanticRegistry,
): RuntimeReactAutomationBridgeWithActions => {
    const handlers = new Map<string, NonNullable<RuntimeReactAutomationNodeRegistration['onAutomationAction']>>()
    const keyOf = (target: RuntimeReactAutomationActionInput['target'], nodeId: string) => `${target}:${nodeId}`

    return {
        registerNode(node: RuntimeReactAutomationNodeRegistration): () => void {
            const key = keyOf(node.target, node.nodeId)
            if (node.onAutomationAction) {
                handlers.set(key, node.onAutomationAction)
            }
            const unregisterNode = registry.registerNode({
                ...node,
                target: node.target,
                availableActions: [...node.availableActions] as any,
            })
            return () => {
                handlers.delete(key)
                unregisterNode()
            }
        },
        updateNode(target, nodeId, patch) {
            registry.updateNode(target, nodeId, {
                ...patch,
                availableActions: patch.availableActions
                    ? [...patch.availableActions] as any
                    : undefined,
            })
        },
        clearVisibleContexts(target, visibleContextKeys) {
            registry.clearScreenContext(target, visibleContextKeys)
        },
        clearTarget(target) {
            for (const key of [...handlers.keys()]) {
                if (key.startsWith(`${target}:`)) {
                    handlers.delete(key)
                }
            }
            registry.clearTarget(target)
        },
        async performNodeAction(input) {
            const handler = handlers.get(keyOf(input.target, input.nodeId))
            if (!handler) {
                return {ok: false, reason: 'NO_ACTION_HANDLER'}
            }
            return await handler(input)
        },
    }
}
