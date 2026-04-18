import type {SemanticRegistry} from '../foundations/semanticRegistry'
import type {AutomationNodeSnapshot} from '../types/selectors'

export const registerAutomationNode = (
    registry: SemanticRegistry,
    node: AutomationNodeSnapshot,
): (() => void) => registry.registerNode(node)
