import type {RequestId} from '@next/kernel-base-contracts'
import type {WorkflowDefinition} from './definition'
import type {WorkflowObservation} from './observation'

export interface WorkflowDefinitionsBySource {
    module: Record<string, readonly WorkflowDefinition[]>
    host: Record<string, readonly WorkflowDefinition[]>
    remote: Record<string, readonly WorkflowDefinition[]>
    test: Record<string, readonly WorkflowDefinition[]>
}

export interface WorkflowDefinitionsState {
    bySource: WorkflowDefinitionsBySource
    updatedAt: number
}

export interface WorkflowObservationsState {
    byRequestId: Record<string, WorkflowObservation>
    updatedAt: number
}

export interface WorkflowQueueState {
    activeRequestId?: RequestId
    queuedRequestIds: readonly RequestId[]
    updatedAt: number
}

export interface WorkflowRuntimeState {
    definitions: WorkflowDefinitionsState
    observations: WorkflowObservationsState
    queue: WorkflowQueueState
}
