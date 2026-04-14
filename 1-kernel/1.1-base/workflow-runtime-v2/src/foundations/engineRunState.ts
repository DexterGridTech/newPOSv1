import type {Subject} from 'rxjs'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {ActorExecutionContext} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    RunWorkflowInput,
    WorkflowObservation,
} from '../types'
import {isTerminalObservation} from './engineObservation'

export interface WorkflowRunRecord {
    input: RunWorkflowInput
    subject: Subject<WorkflowObservation>
    actorContext?: ActorExecutionContext
    started: boolean
    settled: boolean
    resolveTerminal?: (observation: WorkflowObservation) => void
    rejectTerminal?: (error: unknown) => void
}

export const createTerminalPromise = (
    run: WorkflowRunRecord,
): Promise<WorkflowObservation> => {
    return new Promise<WorkflowObservation>((resolve, reject) => {
        run.resolveTerminal = resolve
        run.rejectTerminal = reject
    })
}

export const collectRetainedRequestIds = (input: {
    observations: Record<string, WorkflowObservation>
    activeRequestIds: ReadonlySet<RequestId>
    completedObservationLimit: number
}): readonly RequestId[] => {
    const activeObservationRequestIds = Object.keys(input.observations)
        .filter(requestId => input.activeRequestIds.has(requestId as RequestId))
        .map(requestId => requestId as RequestId)

    const terminalRequestIds = Object.values(input.observations)
        .filter(observation =>
            isTerminalObservation(observation)
            && !input.activeRequestIds.has(observation.requestId),
        )
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .slice(0, input.completedObservationLimit)
        .map(observation => observation.requestId)

    return [
        ...activeObservationRequestIds,
        ...terminalRequestIds,
    ]
}
