import type {RequestId} from '@impos2/kernel-base-contracts'
import type {ExecutionResult} from '@impos2/kernel-base-execution-runtime'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {DispatchRuntimeCommandInput} from '@impos2/kernel-base-runtime-shell'
import type {ResolvedParameter} from '@impos2/kernel-base-contracts'
import type {WorkflowStepRunId, WorkflowRunId} from './ids'
import type {WorkflowContextSnapshot} from './observation'
import type {WorkflowStepType} from './definition'

export interface WorkflowAdapterExecuteInput<TInput = unknown> {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    stepRunId: WorkflowStepRunId
    stepKey: string
    input: TInput
    context: WorkflowContextSnapshot
    signal: AbortSignal
    logger: LoggerPort
    dispatchChild(input: DispatchRuntimeCommandInput): Promise<ExecutionResult>
    resolveParameter<T>(key: string): ResolvedParameter<T>
}

export type WorkflowAdapterEvent<TOutput = unknown> =
    | {type: 'progress'; payload?: unknown}
    | {type: 'output'; output: TOutput}

export interface WorkflowAdapter<TInput = unknown, TOutput = unknown> {
    type: WorkflowStepType
    execute(input: WorkflowAdapterExecuteInput<TInput>): AsyncIterable<WorkflowAdapterEvent<TOutput>> | Promise<TOutput>
}
