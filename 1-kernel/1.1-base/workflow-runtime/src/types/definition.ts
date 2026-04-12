import type {RequestId} from '@impos2/kernel-base-contracts'
import type {WorkflowDefinitionId, WorkflowRunId} from './ids'

export interface WorkflowSchemaDescriptor {
    schemaType: 'json-schema-lite'
    required?: readonly string[]
    properties?: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown'
        sensitive?: boolean
    }>
}

export interface WorkflowPlatformMatcher {
    os?: string
    osVersion?: string
    deviceModel?: string
    runtimeVersion?: string
    capabilities?: readonly string[]
}

export type WorkflowExpression =
    | {type: 'path'; path: string}
    | {type: 'script'; language: 'javascript'; source: string}

export interface WorkflowInputMapping {
    from?: string
    value?: unknown
    object?: Record<string, WorkflowExpression | unknown>
}

export interface WorkflowOutputMapping {
    toStepOutput?: boolean
    variables?: Record<string, WorkflowExpression>
    result?: WorkflowExpression
}

export type WorkflowStepType =
    | 'flow'
    | 'command'
    | 'external-call'
    | 'external-subscribe'
    | 'external-on'
    | 'custom'

export interface WorkflowStepStrategy {
    onError?: 'fail' | 'retry' | 'skip' | 'compensate'
    retry?: {
        times: number
        intervalMs: number
        backoff?: 'fixed' | 'linear'
    }
    compensationStepKey?: string
}

export interface WorkflowStepDefinition {
    stepKey: string
    name: string
    type: WorkflowStepType
    timeoutMs?: number
    condition?: WorkflowExpression
    input?: WorkflowInputMapping
    output?: WorkflowOutputMapping
    strategy?: WorkflowStepStrategy
    steps?: readonly WorkflowStepDefinition[]
}

export interface WorkflowRunContextInput {
    businessKey?: string
    workspace?: string
    displayMode?: string
    instanceMode?: string
    attributes?: Record<string, unknown>
}

export interface WorkflowRunOptions {
    loop?: boolean | {
        enabled: boolean
        maxLoops?: number
        intervalMs?: number
        resetVariables?: boolean
    }
    timeoutMs?: number
    progressHistoryLimit?: number
}

export interface WorkflowDefinition<TInput = unknown, TOutput = unknown> {
    definitionId?: WorkflowDefinitionId
    workflowKey: string
    moduleName: string
    name: string
    description?: string
    enabled: boolean
    version?: string
    tags?: readonly string[]
    platform?: WorkflowPlatformMatcher
    inputSchema?: WorkflowSchemaDescriptor
    outputSchema?: WorkflowSchemaDescriptor
    rootStep: WorkflowStepDefinition
    timeoutMs?: number
    defaultOptions?: WorkflowRunOptions
    createdAt?: number
    updatedAt?: number
}

export interface RunWorkflowInput<TInput = unknown> {
    workflowKey: string
    requestId: RequestId
    input?: TInput
    workflowRunId?: WorkflowRunId
    context?: WorkflowRunContextInput
    options?: WorkflowRunOptions
}

export interface RunWorkflowCommandInput<TInput = unknown> {
    workflowKey: string
    input?: TInput
    context?: WorkflowRunContextInput
    options?: WorkflowRunOptions
}

export interface RegisterWorkflowDefinitionsInput {
    definitions: readonly WorkflowDefinition[]
    source: 'module' | 'host' | 'remote' | 'test'
    updatedAt?: number
}

export interface RemoveWorkflowDefinitionInput {
    workflowKey: string
    definitionId?: string
}
