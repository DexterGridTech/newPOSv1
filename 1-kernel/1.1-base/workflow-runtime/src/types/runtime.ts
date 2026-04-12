import type {Observable} from 'rxjs'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import type {
    CancelWorkflowRunInput,
    WorkflowObservation,
} from './observation'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowInput,
} from './definition'

export interface WorkflowRuntime {
    run$<TInput = unknown>(input: RunWorkflowInput<TInput>): Observable<WorkflowObservation>
    cancel(input: CancelWorkflowRunInput): void
    getObservation(requestId: RequestId): WorkflowObservation | undefined
}

export interface WorkflowRuntimeFacade extends WorkflowRuntime {
    registerDefinitions(input: RegisterWorkflowDefinitionsInput): void
    removeDefinition(input: RemoveWorkflowDefinitionInput): void
}

export interface CreateWorkflowRuntimeModuleInput {
    initialDefinitions?: RegisterWorkflowDefinitionsInput['definitions']
    remoteDefinitionTopicKey?: string
    onRuntimeReady?: (runtime: WorkflowRuntimeFacade) => void
}

export interface RunWorkflowSummary extends Record<string, unknown> {
    requestId: RequestId
    workflowRunId: string
    workflowKey: string
    status: WorkflowObservation['status']
    result?: {
        output?: unknown
        variables?: Record<string, unknown>
        stepOutputs?: Record<string, unknown>
    }
    error?: WorkflowObservation['error']
    completedAt?: number
}

export interface WorkflowRuntimeModuleFactory {
    (input?: CreateWorkflowRuntimeModuleInput): KernelRuntimeModule
}
