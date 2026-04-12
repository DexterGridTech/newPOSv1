import {
    createAppError,
    createEnvelopeId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {
    RequestId,
    ResolvedErrorView,
} from '@impos2/kernel-base-contracts'
import {
    workflowRuntimeErrorDefinitions,
    workflowRuntimeParameterDefinitions,
} from '../supports'
import type {
    WorkflowContextSnapshot,
    WorkflowErrorView,
    WorkflowEvent,
    WorkflowObservation,
    WorkflowRunId,
    WorkflowRunStatus,
    WorkflowStepObservation,
    WorkflowStepRunId,
    WorkflowStepStatus,
} from '../types'

export const toWorkflowErrorView = (input: {
    error?: ResolvedErrorView
    appError?: ReturnType<typeof createAppError>
}): WorkflowErrorView | undefined => {
    if (input.error) {
        return {
            key: input.error.key,
            code: input.error.code,
            message: input.error.message,
            category: input.error.category,
            severity: input.error.severity,
        }
    }
    if (input.appError) {
        return {
            key: input.appError.key,
            code: input.appError.code,
            message: input.appError.message,
            category: input.appError.category,
            severity: input.appError.severity,
        }
    }
    return undefined
}

export const createInitialContextSnapshot = (input: unknown): WorkflowContextSnapshot => ({
    input,
    variables: {},
    stepOutputs: {},
    loopIndex: 0,
    updatedAt: nowTimestampMs(),
})

export const createWorkflowEvent = (
    input: {
        requestId: RequestId
        workflowRunId: WorkflowRunId
        type: WorkflowEvent['type']
        stepRunId?: WorkflowStepRunId
        stepKey?: string
        payload?: unknown
        error?: WorkflowErrorView
        occurredAt?: number
    },
): WorkflowEvent => ({
    eventId: createEnvelopeId(),
    requestId: input.requestId,
    workflowRunId: input.workflowRunId,
    stepRunId: input.stepRunId,
    stepKey: input.stepKey,
    type: input.type,
    payload: input.payload,
    error: input.error,
    occurredAt: input.occurredAt ?? nowTimestampMs(),
})

export const createInitialObservation = (
    input: {
        requestId: RequestId
        workflowRunId: WorkflowRunId
        workflowKey: string
        status: WorkflowRunStatus
        queuePosition?: number
        contextInput?: unknown
    },
): WorkflowObservation => {
    const startedAt = nowTimestampMs()
    const event = createWorkflowEvent({
        requestId: input.requestId,
        workflowRunId: input.workflowRunId,
        type: input.status === 'WAITING_IN_QUEUE' ? 'workflow.waiting' : 'workflow.started',
        occurredAt: startedAt,
    })
    return {
        requestId: input.requestId,
        workflowRunId: input.workflowRunId,
        workflowKey: input.workflowKey,
        status: input.status,
        queuePosition: input.queuePosition,
        startedAt,
        updatedAt: startedAt,
        progress: {
            current: 0,
            total: 0,
            percent: 0,
        },
        loopIndex: 0,
        context: createInitialContextSnapshot(input.contextInput),
        steps: {},
        events: [event],
    }
}

export const patchObservation = (
    observation: WorkflowObservation,
    patch: Partial<WorkflowObservation>,
    event?: WorkflowEvent,
): WorkflowObservation => {
    return {
        ...observation,
        ...patch,
        updatedAt: patch.updatedAt ?? nowTimestampMs(),
        events: event ? [...observation.events, event] : observation.events,
    }
}

export const createStepObservation = (input: {
    stepRunId: WorkflowStepRunId
    stepKey: string
    type: WorkflowStepObservation['type']
    status: WorkflowStepStatus
    output?: unknown
    error?: WorkflowErrorView
}): WorkflowStepObservation => {
    const timestamp = nowTimestampMs()
    return {
        stepRunId: input.stepRunId,
        stepKey: input.stepKey,
        type: input.type,
        status: input.status,
        startedAt: input.status === 'RUNNING' ? timestamp : undefined,
        updatedAt: timestamp,
        completedAt: input.status === 'COMPLETED' ? timestamp : undefined,
        output: input.output,
        error: input.error,
    }
}

export const createDefinitionNotFoundError = (workflowKey: string) => {
    return createAppError(workflowRuntimeErrorDefinitions.workflowDefinitionNotFound, {
        args: {workflowKey},
    })
}

export const createDefinitionDisabledError = (workflowKey: string) => {
    return createAppError(workflowRuntimeErrorDefinitions.workflowDefinitionDisabled, {
        args: {workflowKey},
    })
}

export const createDuplicateRequestError = (requestId: RequestId) => {
    return createAppError(workflowRuntimeErrorDefinitions.workflowRunDuplicateRequest, {
        args: {requestId},
    })
}

export const createRunNotFoundError = () => {
    return createAppError(workflowRuntimeErrorDefinitions.workflowRunNotFound, {})
}

export const createStepFailedError = (stepKey: string, details?: unknown) => {
    return createAppError(workflowRuntimeErrorDefinitions.workflowStepFailed, {
        args: {stepKey},
        details,
    })
}

export const defaultProgressHistoryLimitKey = workflowRuntimeParameterDefinitions.progressHistoryLimit.key
