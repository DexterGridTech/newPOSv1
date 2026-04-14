import type {Observable} from 'rxjs'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    CancelWorkflowRunInput,
    WorkflowObservation,
} from './observation'
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowInput,
    WorkflowPlatformMatcher,
} from './definition'

export interface WorkflowRuntimeV2 {
    run$<TInput = unknown>(input: RunWorkflowInput<TInput>): Observable<WorkflowObservation>
    cancel(input: CancelWorkflowRunInput): void
    getObservation(requestId: RequestId): WorkflowObservation | undefined
}

export interface WorkflowRuntimeFacadeV2 extends WorkflowRuntimeV2 {
    registerDefinitions(input: RegisterWorkflowDefinitionsInput): Promise<void>
    removeDefinition(input: RemoveWorkflowDefinitionInput): Promise<void>
}

export interface RunWorkflowSummary {
    requestId: RequestId
    workflowRunId: string
    workflowKey: string
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
    result?: {
        output?: unknown
        variables?: Record<string, unknown>
        stepOutputs?: Record<string, unknown>
    }
    error?: WorkflowObservation['error']
    completedAt?: number
}

export interface CreateWorkflowRuntimeModuleV2Input {
    initialDefinitions?: RegisterWorkflowDefinitionsInput['definitions']
    remoteDefinitionTopicKey?: string
    runtimePlatform?: WorkflowPlatformMatcher
    onRuntimeReady?: (runtime: WorkflowRuntimeFacadeV2) => void
}

export interface WorkflowRuntimeModuleFactoryV2 {
    (input?: CreateWorkflowRuntimeModuleV2Input): KernelRuntimeModuleV2
}
