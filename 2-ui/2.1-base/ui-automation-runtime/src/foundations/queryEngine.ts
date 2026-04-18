import type {AutomationTrace} from './automationTrace'
import type {SemanticRegistry} from './semanticRegistry'
import type {AutomationNodeQuery} from '../types/selectors'

export const createQueryEngine = (input: {
    readonly registry: SemanticRegistry
    readonly trace: AutomationTrace
}) => ({
    queryNodes(query: AutomationNodeQuery) {
        const nodes = input.registry.queryNodes(query)
        input.trace.record({
            step: 'ui.queryNodes',
            status: 'ok',
            input: query,
            output: {count: nodes.length},
        })
        return nodes
    },
})
