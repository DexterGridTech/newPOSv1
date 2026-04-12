import type {
    WorkflowDefinition,
    WorkflowDefinitionsBySource,
} from '../types'

const SOURCE_PRIORITY = ['host', 'remote', 'module', 'test'] as const

const sortDefinitions = (definitions: readonly WorkflowDefinition[]) =>
    [...definitions].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

export const resolveWorkflowDefinitionFromSources = (
    bySource: WorkflowDefinitionsBySource | undefined,
    workflowKey: string,
): WorkflowDefinition | undefined => {
    if (!bySource) {
        return undefined
    }

    for (const source of SOURCE_PRIORITY) {
        const candidates = sortDefinitions(bySource[source][workflowKey] ?? [])
        if (candidates.length === 0) {
            continue
        }
        return candidates[0]
    }

    return undefined
}

export const hasOnlyDisabledDefinitionsBySource = (
    bySource: WorkflowDefinitionsBySource | undefined,
    workflowKey: string,
): boolean => {
    if (!bySource) {
        return false
    }

    const allDefinitions = SOURCE_PRIORITY.flatMap(source => bySource[source][workflowKey] ?? [])
    return allDefinitions.length > 0 && allDefinitions.every(item => item.enabled === false)
}
