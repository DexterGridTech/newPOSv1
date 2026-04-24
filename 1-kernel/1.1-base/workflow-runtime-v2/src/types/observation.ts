import type {
    AppError,
    RequestId,
} from '@next/kernel-base-contracts'
import type {
    WorkflowRunId,
    WorkflowStepRunId,
} from './ids'
import type {WorkflowStepType} from './definition'

export interface WorkflowErrorView {
    key: string
    code: string
    message: string
    category?: AppError['category']
    severity?: AppError['severity']
}

export interface WorkflowContextSnapshot {
    input: unknown
    variables: Record<string, unknown>
    stepOutputs: Record<string, unknown>
    loopIndex: number
    updatedAt: number
}

export type WorkflowStepStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'COMPLETED'
    | 'SKIPPED'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMED_OUT'

export interface WorkflowStepObservation<TOutput = unknown> {
    stepRunId: WorkflowStepRunId
    stepKey: string
    type: WorkflowStepType
    status: WorkflowStepStatus
    startedAt?: number
    updatedAt: number
    completedAt?: number
    output?: TOutput
    error?: WorkflowErrorView
    retryCount?: number
}

export type WorkflowEventType =
    | 'workflow.waiting'
    | 'workflow.started'
    | 'workflow.loop.started'
    | 'workflow.loop.completed'
    | 'workflow.completed'
    | 'workflow.failed'
    | 'workflow.cancelled'
    | 'workflow.timed-out'
    | 'step.started'
    | 'step.progress'
    | 'step.completed'
    | 'step.skipped'
    | 'step.retrying'
    | 'step.compensating'
    | 'step.failed'
    | 'step.cancelled'
    | 'step.timed-out'

export interface WorkflowEvent<TPayload = unknown> {
    eventId: string
    requestId: RequestId
    workflowRunId: WorkflowRunId
    stepRunId?: WorkflowStepRunId
    stepKey?: string
    type: WorkflowEventType
    payload?: TPayload
    error?: WorkflowErrorView
    occurredAt: number
}

export type WorkflowRunStatus =
    | 'WAITING_IN_QUEUE'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'TIMED_OUT'

export interface WorkflowObservation<TOutput = unknown> {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    status: WorkflowRunStatus
    queuePosition?: number
    startedAt: number
    updatedAt: number
    completedAt?: number
    cancelledAt?: number
    timedOutAt?: number
    progress: {
        current: number
        total: number
        percent: number
        activeStepKey?: string
    }
    loopIndex: number
    context: WorkflowContextSnapshot
    steps: Record<string, WorkflowStepObservation>
    events: readonly WorkflowEvent[]
    output?: TOutput
    error?: WorkflowErrorView
}

export interface CancelWorkflowRunInput {
    requestId?: RequestId
    workflowRunId?: WorkflowRunId
    reason?: string
}
