import type {AutomationTrace} from './automationTrace'
import type {SemanticRegistry} from './semanticRegistry'
import type {AutomationActionResult, PerformNodeActionInput} from '../types/actions'

export const createActionExecutor = (input: {
    readonly registry: SemanticRegistry
    readonly trace: AutomationTrace
    readonly performNodeAction?: (action: PerformNodeActionInput) => Promise<unknown> | unknown
}) => ({
    async performAction(action: PerformNodeActionInput): Promise<AutomationActionResult> {
        const node = input.registry.getNode(action.target, action.nodeId)
        if (!node || node.stale) {
            input.trace.record({
                step: 'ui.performAction',
                status: 'failed',
                input: action,
                error: 'STALE_NODE',
            })
            throw new Error('STALE_NODE')
        }
        if (!node.visible || !node.enabled || !node.availableActions.includes(action.action)) {
            input.trace.record({
                step: 'ui.performAction',
                status: 'failed',
                input: action,
                error: 'NODE_NOT_ACTIONABLE',
            })
            throw new Error('NODE_NOT_ACTIONABLE')
        }
        const delegatedResult = await input.performNodeAction?.(action)
        if (
            delegatedResult != null
            && typeof delegatedResult === 'object'
            && 'ok' in delegatedResult
            && (delegatedResult as {ok?: unknown}).ok === false
        ) {
            const message = typeof (delegatedResult as {reason?: unknown}).reason === 'string'
                ? String((delegatedResult as {reason?: unknown}).reason)
                : 'ACTION_HANDLER_REJECTED'
            input.trace.record({
                step: 'ui.performAction',
                status: 'failed',
                input: action,
                error: message,
                output: delegatedResult,
            })
            throw new Error(message)
        }
        const result = {ok: true, nodeId: action.nodeId}
        input.trace.record({
            step: 'ui.performAction',
            status: 'ok',
            input: action,
            output: result,
        })
        return result
    },
})
