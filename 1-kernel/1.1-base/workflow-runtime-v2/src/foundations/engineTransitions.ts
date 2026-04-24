import {nowTimestampMs} from '@next/kernel-base-contracts'
import type {
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowStepDefinition,
} from '../types'
import {
    createStepObservation,
    createWorkflowEvent,
    patchObservation,
    toWorkflowErrorView,
} from './defaults'
import {createStepFailedError} from './defaults'

export const markStepStarted = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    stepRunId: string
    progressTotal: number
}): WorkflowObservation => {
    const startedAt = nowTimestampMs()
    return patchObservation(
        input.observation,
        {
            status: 'RUNNING',
            progress: {
                ...input.observation.progress,
                total: input.progressTotal,
                activeStepKey: input.step.stepKey,
            },
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...createStepObservation(input.step),
                    stepRunId: input.stepRunId as any,
                    status: 'RUNNING',
                    startedAt,
                    updatedAt: startedAt,
                },
            },
            updatedAt: startedAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.started',
            occurredAt: startedAt,
        }),
    )
}

export const markStepSkipped = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    progress: {current: number; total: number}
    error?: WorkflowObservation['error']
}): WorkflowObservation => {
    input.progress.current += 1
    const skippedAt = nowTimestampMs()
    return patchObservation(
        input.observation,
        {
            progress: {
                current: input.progress.current,
                total: input.progress.total,
                percent: input.progress.total > 0
                    ? Math.round((input.progress.current / input.progress.total) * 100)
                    : 100,
                activeStepKey: input.step.stepKey,
            },
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...input.observation.steps[input.step.stepKey],
                    status: 'SKIPPED',
                    error: input.error,
                    completedAt: skippedAt,
                    updatedAt: skippedAt,
                },
            },
            updatedAt: skippedAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.skipped',
            error: input.error,
            occurredAt: skippedAt,
        }),
    )
}

export const markStepRetrying = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    attempt: number
    maxRetries: number
}): WorkflowObservation => {
    const retryAt = nowTimestampMs()
    return patchObservation(
        input.observation,
        {
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...input.observation.steps[input.step.stepKey],
                    retryCount: input.attempt,
                    updatedAt: retryAt,
                },
            },
            updatedAt: retryAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.retrying',
            payload: {
                attempt: input.attempt,
                maxRetries: input.maxRetries,
            },
            occurredAt: retryAt,
        }),
    )
}

export const markStepCompleted = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    progress: {current: number; total: number}
    output: unknown
    variablesPatch: Record<string, unknown>
}): WorkflowObservation => {
    input.progress.current += 1
    const completedAt = nowTimestampMs()
    return patchObservation(
        input.observation,
        {
            progress: {
                current: input.progress.current,
                total: input.progress.total,
                percent: input.progress.total > 0
                    ? Math.round((input.progress.current / input.progress.total) * 100)
                    : 100,
                activeStepKey: input.step.stepKey,
            },
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...input.observation.steps[input.step.stepKey],
                    status: 'COMPLETED',
                    output: input.output,
                    completedAt,
                    updatedAt: completedAt,
                },
            },
            context: {
                ...input.observation.context,
                variables: {
                    ...input.observation.context.variables,
                    ...input.variablesPatch,
                },
                stepOutputs: {
                    ...input.observation.context.stepOutputs,
                    [input.step.stepKey]: input.output,
                },
                updatedAt: completedAt,
            },
            updatedAt: completedAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.completed',
            payload: input.output,
            occurredAt: completedAt,
        }),
    )
}

export const markStepCompensating = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    compensationStepKey: string
    error: ReturnType<typeof toWorkflowErrorView>
}): WorkflowObservation => {
    const compensatingAt = nowTimestampMs()
    return patchObservation(
        input.observation,
        {
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...input.observation.steps[input.step.stepKey],
                    status: 'FAILED',
                    error: input.error ?? undefined,
                    updatedAt: compensatingAt,
                },
            },
            updatedAt: compensatingAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.compensating',
            payload: {
                compensationStepKey: input.compensationStepKey,
            },
            error: input.error ?? undefined,
            occurredAt: compensatingAt,
        }),
    )
}

export const markStepFailed = (input: {
    observation: WorkflowObservation
    step: WorkflowStepDefinition
    error: ReturnType<typeof toWorkflowErrorView>
    completedAt?: number
}): WorkflowObservation => {
    const failedAt = input.completedAt ?? nowTimestampMs()
    const failedObservation = patchObservation(
        input.observation,
        {
            status: 'FAILED',
            error: input.error ?? undefined,
            steps: {
                ...input.observation.steps,
                [input.step.stepKey]: {
                    ...input.observation.steps[input.step.stepKey],
                    status: 'FAILED',
                    error: input.error ?? undefined,
                    updatedAt: failedAt,
                },
            },
            completedAt: failedAt,
            updatedAt: failedAt,
        },
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            stepKey: input.step.stepKey,
            type: 'step.failed',
            error: input.error ?? undefined,
            occurredAt: failedAt,
        }),
    )

    return patchObservation(
        failedObservation,
        {},
        createWorkflowEvent({
            requestId: input.observation.requestId,
            workflowRunId: input.observation.workflowRunId,
            type: 'workflow.failed',
            error: input.error ?? undefined,
            occurredAt: failedAt,
        }),
    )
}

export const ensureCommandStepRunnable = (input: {
    step: WorkflowStepDefinition
    commandName?: string
    hasActorContext: boolean
}) => {
    if (!input.commandName) {
        throw createStepFailedError(input.step.stepKey, {reason: 'missing commandName'})
    }
    if (!input.hasActorContext) {
        throw createStepFailedError(input.step.stepKey, {reason: 'missing actor context'})
    }
}
