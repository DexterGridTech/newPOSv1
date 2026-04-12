import type {WorkflowDefinition, WorkflowDefinitionsBySource} from '../types'

export const workflowDefinitionSourcePriority: readonly (keyof WorkflowDefinitionsBySource)[] = [
    'host',
    'remote',
    'module',
    'test',
]

export const resolveWorkflowDefinition = (
    definitions: readonly WorkflowDefinition[],
): WorkflowDefinition | undefined => {
    const enabled = definitions.filter(definition => definition.enabled)
    if (enabled.length === 0) {
        return undefined
    }
    return [...enabled].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0]
}

export const resolveWorkflowDefinitionFromSources = (
    definitionsBySource: WorkflowDefinitionsBySource | undefined,
    workflowKey: string,
): WorkflowDefinition | undefined => {
    if (!definitionsBySource) {
        return undefined
    }

    for (const source of workflowDefinitionSourcePriority) {
        const resolved = resolveWorkflowDefinition(definitionsBySource[source][workflowKey] ?? [])
        if (resolved) {
            return resolved
        }
    }

    return undefined
}

export const hasOnlyDisabledDefinitions = (
    definitions: readonly WorkflowDefinition[],
) => definitions.length > 0 && definitions.every(definition => !definition.enabled)

export const hasOnlyDisabledDefinitionsBySource = (
    definitionsBySource: WorkflowDefinitionsBySource | undefined,
    workflowKey: string,
) => {
    if (!definitionsBySource) {
        return false
    }

    const definitions = workflowDefinitionSourcePriority.flatMap(source =>
        [...(definitionsBySource[source][workflowKey] ?? [])],
    )
    return hasOnlyDisabledDefinitions(definitions)
}
