import type {
    WorkflowDefinition,
    WorkflowDefinitionsBySource,
    WorkflowPlatformMatcher,
} from '../types'

const SOURCE_PRIORITY = ['host', 'remote', 'module', 'test'] as const

const sortDefinitions = (definitions: readonly WorkflowDefinition[]) =>
    [...definitions].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

const hasPlatformMatcher = (definition: WorkflowDefinition): boolean => {
    const matcher = definition.platform
    if (!matcher) {
        return false
    }
    return Boolean(
        matcher.os
        || matcher.osVersion
        || matcher.deviceModel
        || matcher.runtimeVersion
        || (matcher.capabilities?.length ?? 0) > 0,
    )
}

const matchesRuntimePlatform = (
    definition: WorkflowDefinition,
    runtimePlatform?: WorkflowPlatformMatcher,
): boolean => {
    const matcher = definition.platform
    if (!matcher) {
        return true
    }
    if (!hasPlatformMatcher(definition)) {
        return true
    }
    if (!runtimePlatform) {
        return false
    }
    if (matcher.os && matcher.os !== runtimePlatform.os) {
        return false
    }
    if (matcher.osVersion && matcher.osVersion !== runtimePlatform.osVersion) {
        return false
    }
    if (matcher.deviceModel && matcher.deviceModel !== runtimePlatform.deviceModel) {
        return false
    }
    if (matcher.runtimeVersion && matcher.runtimeVersion !== runtimePlatform.runtimeVersion) {
        return false
    }
    if (matcher.capabilities?.length) {
        const runtimeCapabilities = new Set(runtimePlatform.capabilities ?? [])
        if (!matcher.capabilities.every(item => runtimeCapabilities.has(item))) {
            return false
        }
    }
    return true
}

const resolveDefinitionFromSource = (
    definitions: readonly WorkflowDefinition[],
    runtimePlatform?: WorkflowPlatformMatcher,
): WorkflowDefinition | undefined => {
    const candidates = sortDefinitions(definitions)
    if (candidates.length === 0) {
        return undefined
    }

    const matchedSpecific = candidates.find(item =>
        hasPlatformMatcher(item) && matchesRuntimePlatform(item, runtimePlatform),
    )
    if (matchedSpecific) {
        return matchedSpecific
    }

    return candidates.find(item => !hasPlatformMatcher(item))
}

export const resolveWorkflowDefinitionFromSources = (
    bySource: WorkflowDefinitionsBySource | undefined,
    workflowKey: string,
    runtimePlatform?: WorkflowPlatformMatcher,
): WorkflowDefinition | undefined => {
    if (!bySource) {
        return undefined
    }

    for (const source of SOURCE_PRIORITY) {
        const resolved = resolveDefinitionFromSource(
            bySource[source][workflowKey] ?? [],
            runtimePlatform,
        )
        if (!resolved) {
            continue
        }
        return resolved
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
