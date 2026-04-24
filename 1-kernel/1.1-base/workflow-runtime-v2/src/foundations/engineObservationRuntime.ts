import {Subject} from 'rxjs'
import {
    nowTimestampMs,
    type RequestId,
} from '@next/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import type {WorkflowObservation} from '../types'
import {
    workflowRuntimeV2StateActions,
    WORKFLOW_OBSERVATIONS_STATE_KEY,
} from '../features/slices'
import {selectWorkflowObservationByRequestId} from '../selectors'
import {
    cloneObservation,
    isTerminalObservation,
    trimEvents,
} from './engineObservation'
import {
    collectRetainedRequestIds,
    type WorkflowRunRecord,
} from './engineRunState'
import type {WorkflowRuntimeRegistryRecord} from './runtime'

export interface WorkflowObservationRuntime {
    registerObserverBridge(): void
    notify(observation: WorkflowObservation): void
    trimCompletedObservations(): void
}

export const createWorkflowObservationRuntime = (input: {
    context: RuntimeModuleContextV2
    registry: WorkflowRuntimeRegistryRecord
    runsByRequestId: Map<RequestId, WorkflowRunRecord>
    getActiveRequestIds(): readonly RequestId[]
    getEventHistoryLimit(): number
    getCompletedObservationLimit(): number
}): WorkflowObservationRuntime => {
    /**
     * 设计意图：
     * observation 同时写入 slice、run 返回的 Observable 和按 requestId 注册的观察者。
     * 三个出口必须发射同一种结构，保证 command 调用方、selector 和 UI 看到的 workflow 状态完全一致。
     */
    const observersByRequestId = new Map<string, Set<Subject<WorkflowObservation>>>()

    const normalizeObservation = (observation: WorkflowObservation): WorkflowObservation => ({
        ...cloneObservation(observation),
        events: trimEvents(observation.events, input.getEventHistoryLimit()),
    })

    const notify = (observation: WorkflowObservation) => {
        const normalized = normalizeObservation(observation)
        input.context.dispatchAction(workflowRuntimeV2StateActions.putObservation(normalized))
        input.runsByRequestId.get(normalized.requestId)?.subject.next(cloneObservation(normalized))
        const subjects = observersByRequestId.get(normalized.requestId)
        if (subjects) {
            subjects.forEach(subject => {
                subject.next(cloneObservation(normalized))
                if (isTerminalObservation(normalized)) {
                    subject.complete()
                }
            })
        }

        if (isTerminalObservation(normalized)) {
            input.runsByRequestId.get(normalized.requestId)?.subject.complete()
            observersByRequestId.delete(normalized.requestId)
        }
    }

    const trimCompletedObservations = () => {
        const observations =
            (
                input.context.getState()[WORKFLOW_OBSERVATIONS_STATE_KEY as keyof ReturnType<RuntimeModuleContextV2['getState']>] as
                    | {byRequestId: Record<string, WorkflowObservation>}
                    | undefined
            )?.byRequestId ?? {}
        const retainRequestIds = collectRetainedRequestIds({
            observations,
            activeRequestIds: new Set<RequestId>(input.getActiveRequestIds()),
            completedObservationLimit: input.getCompletedObservationLimit(),
        })

        if (retainRequestIds.length === Object.keys(observations).length) {
            return
        }

        input.context.dispatchAction(workflowRuntimeV2StateActions.trimTerminalObservations({
            retainRequestIds,
            updatedAt: nowTimestampMs(),
        }))
    }

    const registerObserverBridge = () => {
        input.registry.addObserver = (requestId, listener) => {
            const subject = new Subject<WorkflowObservation>()
            const listeners = observersByRequestId.get(requestId) ?? new Set<Subject<WorkflowObservation>>()
            listeners.add(subject)
            observersByRequestId.set(requestId, listeners)
            const subscription = subject.subscribe(listener)
            return () => {
                subscription.unsubscribe()
                listeners.delete(subject)
                if (listeners.size === 0) {
                    observersByRequestId.delete(requestId)
                }
            }
        }
    }

    return {
        registerObserverBridge,
        notify,
        trimCompletedObservations,
    }
}
