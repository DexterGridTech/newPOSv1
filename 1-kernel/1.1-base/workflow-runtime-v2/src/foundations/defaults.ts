import {
    createAppError,
    createEnvelopeId,
    nowTimestampMs,
    type AppError,
    type RequestId,
} from '@next/kernel-base-contracts'
import type {
    WorkflowErrorView,
    WorkflowEvent,
    WorkflowEventType,
    WorkflowObservation,
    WorkflowRunId,
    WorkflowStepDefinition,
    WorkflowStepObservation,
    WorkflowStepRunId,
} from '../types'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'

export const createWorkflowRunId = (): WorkflowRunId =>
    createEnvelopeId() as unknown as WorkflowRunId

export const createWorkflowStepRunId = (): WorkflowStepRunId =>
    createEnvelopeId() as unknown as WorkflowStepRunId

export const toWorkflowErrorView = (appError: AppError): WorkflowErrorView => ({
    key: appError.key,
    code: appError.code,
    message: appError.message,
    category: appError.category,
    severity: appError.severity,
})

export const createWorkflowEvent = (input: {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    type: WorkflowEventType
    stepKey?: string
    payload?: unknown
    error?: WorkflowErrorView
    occurredAt?: number
}): WorkflowEvent => ({
    eventId: createEnvelopeId(),
    requestId: input.requestId,
    workflowRunId: input.workflowRunId,
    stepKey: input.stepKey,
    type: input.type,
    payload: input.payload,
    error: input.error,
    occurredAt: input.occurredAt ?? nowTimestampMs(),
})

export const createInitialObservation = (input: {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    status: WorkflowObservation['status']
    contextInput?: unknown
}): WorkflowObservation => {
    const now = nowTimestampMs()
    return {
        requestId: input.requestId,
        workflowRunId: input.workflowRunId,
        workflowKey: input.workflowKey,
        status: input.status,
        startedAt: now,
        updatedAt: now,
        progress: {
            current: 0,
            total: 1,
            percent: 0,
        },
        loopIndex: 0,
        context: {
            input: input.contextInput,
            variables: {},
            stepOutputs: {},
            loopIndex: 0,
            updatedAt: now,
        },
        steps: {},
        events: [],
    }
}

export const createFailedObservation = (input: {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    error: AppError
    contextInput?: unknown
}): WorkflowObservation => {
    const base = createInitialObservation({
        requestId: input.requestId,
        workflowRunId: input.workflowRunId,
        workflowKey: input.workflowKey,
        status: 'RUNNING',
        contextInput: input.contextInput,
    })
    const failedAt = nowTimestampMs()
    const error = toWorkflowErrorView(input.error)
    return patchObservation(
        base,
        {
            status: 'FAILED',
            error,
            completedAt: failedAt,
            updatedAt: failedAt,
        },
        createWorkflowEvent({
            requestId: input.requestId,
            workflowRunId: base.workflowRunId,
            type: 'workflow.failed',
            error,
            occurredAt: failedAt,
        }),
    )
}

export const createStepObservation = (
    step: WorkflowStepDefinition,
): WorkflowStepObservation => ({
    stepRunId: createWorkflowStepRunId(),
    stepKey: step.stepKey,
    type: step.type,
    status: 'PENDING',
    updatedAt: nowTimestampMs(),
})

export const patchObservation = (
    observation: WorkflowObservation,
    patch: Partial<WorkflowObservation>,
    ...events: WorkflowEvent[]
): WorkflowObservation => ({
    ...observation,
    ...patch,
    progress: {
        ...observation.progress,
        ...(patch.progress ?? {}),
    },
    context: {
        ...observation.context,
        ...(patch.context ?? {}),
        variables: {
            ...observation.context.variables,
            ...(patch.context?.variables ?? {}),
        },
        stepOutputs: {
            ...observation.context.stepOutputs,
            ...(patch.context?.stepOutputs ?? {}),
        },
    },
    steps: {
        ...observation.steps,
        ...(patch.steps ?? {}),
    },
    events: [...observation.events, ...events],
})

export const createDefinitionNotFoundError = (workflowKey: string) =>
    createAppError(workflowRuntimeV2ErrorDefinitions.workflowDefinitionNotFound, {
        args: {workflowKey},
    })

export const createDefinitionDisabledError = (workflowKey: string) =>
    createAppError(workflowRuntimeV2ErrorDefinitions.workflowDefinitionDisabled, {
        args: {workflowKey},
    })

export const createDuplicateRequestError = (requestId: string) =>
    createAppError(workflowRuntimeV2ErrorDefinitions.duplicateRequest, {
        args: {requestId},
    })

export const createStepFailedError = (stepKey: string, cause: unknown) =>
    createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
        args: {stepKey},
        cause,
    })

export const createExecutionFailedError = (workflowKey: string, cause: unknown) =>
    createAppError(workflowRuntimeV2ErrorDefinitions.workflowExecutionFailed, {
        args: {workflowKey},
        cause,
    })
