import {
    createAppError,
    type ParameterCatalogEntry,
} from '@impos2/kernel-base-contracts'
import type {
    RunWorkflowSummary,
    WorkflowObservation,
} from '../types'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'

const terminalStatuses = new Set<WorkflowObservation['status']>([
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMED_OUT',
])

export const cloneObservation = (observation: WorkflowObservation): WorkflowObservation => ({
    ...observation,
    progress: {...observation.progress},
    context: {
        ...observation.context,
        variables: {...observation.context.variables},
        stepOutputs: {...observation.context.stepOutputs},
    },
    steps: Object.fromEntries(
        Object.entries(observation.steps).map(([stepKey, step]) => [stepKey, {...step}]),
    ),
    events: [...observation.events],
})

export const trimEvents = (
    events: readonly WorkflowObservation['events'][number][],
    limit: number,
) => {
    if (limit <= 0 || events.length <= limit) {
        return [...events]
    }
    return events.slice(events.length - limit)
}

export const toTerminalSummary = (observation: WorkflowObservation): RunWorkflowSummary => ({
    requestId: observation.requestId,
    workflowRunId: observation.workflowRunId,
    workflowKey: observation.workflowKey,
    status: observation.status as RunWorkflowSummary['status'],
    result: {
        output: observation.output,
        variables: observation.context.variables,
        stepOutputs: observation.context.stepOutputs,
    },
    error: observation.error,
    completedAt: observation.completedAt,
})

export const isTerminalObservation = (observation: WorkflowObservation) =>
    terminalStatuses.has(observation.status)

export const isTimeoutError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error == null || !('details' in error)) {
        return false
    }

    const details = (error as {details?: unknown}).details
    if (typeof details !== 'object' || details == null || !('reason' in details)) {
        return false
    }

    const reason = (details as {reason?: unknown}).reason
    return reason === 'step-timeout' || reason === 'workflow-timeout' || reason === 'timeout'
}

export const withTimeout = async <T>(input: {
    promise: Promise<T>
    timeoutMs?: number
    stepKey: string
    type: 'step' | 'workflow'
}): Promise<T> => {
    if (!input.timeoutMs || input.timeoutMs <= 0) {
        return input.promise
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            input.promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(createAppError(
                        workflowRuntimeV2ErrorDefinitions.workflowStepFailed,
                        {
                            args: {stepKey: input.stepKey},
                            details: {
                                reason: `${input.type}-timeout`,
                                timeoutMs: input.timeoutMs,
                            },
                        },
                    ))
                }, input.timeoutMs)
            }),
        ])
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }
}

export const toParameterNumber = (
    catalog: Record<string, ParameterCatalogEntry>,
    key: string,
    fallback: number,
): number => {
    const raw = catalog[key]?.rawValue
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? raw
        : fallback
}
