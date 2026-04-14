import {Observable, Subject} from 'rxjs'
import {
    nowTimestampMs,
    type RequestId,
} from '@impos2/kernel-base-contracts'
import type {
    ActorExecutionContext,
    RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    CancelWorkflowRunInput,
    RunWorkflowInput,
    RunWorkflowSummary,
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowRuntimeFacadeV2,
} from '../types'
import {workflowRuntimeV2StateActions} from '../features/slices'
import {selectWorkflowObservationByRequestId} from '../selectors'
import {
    createDuplicateRequestError,
    createFailedObservation,
    createInitialObservation,
    createWorkflowEvent,
    createWorkflowRunId,
    patchObservation,
} from './defaults'
import {createWorkflowDefinitionResolver} from './engineDefinition'
import {createWorkflowEngineConfig} from './engineConfig'
import {createWorkflowEngineExecutor} from './engineExecutor'
import {
    cloneObservation,
    isTerminalObservation,
    toTerminalSummary,
} from './engineObservation'
import {createWorkflowObservationRuntime} from './engineObservationRuntime'
import {
    createTerminalPromise,
    type WorkflowEngineMutableState,
    type WorkflowRunRecord,
} from './engineRunState'
import type {WorkflowRuntimeRegistryRecord} from './runtime'

/**
 * 设计意图：
 * workflow engine 负责把定义解析、队列调度、脚本执行和观测发布拼成一个稳定运行面。
 * 它输出的是持续可观测的 observation，而不是只在末尾返回一次性结果，这样 command、selector 和前端 UI 可以共用同一真相视图。
 */
export const createWorkflowEngineV2 = (input: {
    context: RuntimeModuleContextV2
    registry: WorkflowRuntimeRegistryRecord
    runtimePlatform?: WorkflowDefinition['platform']
}): {
    runtime: WorkflowRuntimeFacadeV2
    runFromCommand(
        runInput: RunWorkflowInput,
        actorContext: ActorExecutionContext,
    ): Promise<RunWorkflowSummary>
    registerDefinitions(definitions: WorkflowDefinition[], source: 'module' | 'host' | 'remote' | 'test'): void
    removeDefinition(input: {workflowKey: string; definitionId?: string; source?: 'module' | 'host' | 'remote' | 'test'}): void
    cancel(input: CancelWorkflowRunInput): void
} => {
    const {context, registry, runtimePlatform} = input
    const state: WorkflowEngineMutableState = {
        queue: [],
        runsByRequestId: new Map<RequestId, WorkflowRunRecord>(),
        activeRun: undefined,
    }

    const config = createWorkflowEngineConfig(context)
    const definitionResolver = createWorkflowDefinitionResolver({
        context,
        runtimePlatform,
    })
    const observationRuntime = createWorkflowObservationRuntime({
        context,
        registry,
        runsByRequestId: state.runsByRequestId,
        getActiveRequestIds: () => [
            ...state.queue.map(item => item.input.requestId),
            ...(state.activeRun ? [state.activeRun.input.requestId] : []),
        ],
        getEventHistoryLimit: config.getEventHistoryLimit,
        getCompletedObservationLimit: config.getCompletedObservationLimit,
    })
    const executor = createWorkflowEngineExecutor({
        context,
        config,
        notify: observationRuntime.notify,
    })

    observationRuntime.registerObserverBridge()

    const updateQueueState = () => {
        const updatedAt = nowTimestampMs()
        context.dispatchAction(workflowRuntimeV2StateActions.setActiveRequest({
            requestId: state.activeRun?.input.requestId,
            updatedAt,
        }))
        context.dispatchAction(workflowRuntimeV2StateActions.replaceQueuedRequests({
            requestIds: state.queue.map(item => item.input.requestId),
            updatedAt,
        }))

        state.queue.forEach((item, index) => {
            const current = selectWorkflowObservationByRequestId(context.getState(), item.input.requestId)
            if (!current || isTerminalObservation(current)) {
                return
            }
            observationRuntime.notify({
                ...current,
                queuePosition: index + 1,
                updatedAt,
            })
        })
    }

    const settleRun = (run: WorkflowRunRecord, observation: WorkflowObservation) => {
        if (run.settled) {
            return
        }

        run.settled = true
        const normalized = cloneObservation(observation)
        observationRuntime.notify(normalized)
        run.subject.complete()
        run.resolveTerminal?.(cloneObservation(normalized))
        state.runsByRequestId.delete(normalized.requestId)

        if (state.activeRun?.input.requestId === normalized.requestId) {
            state.activeRun = undefined
        } else {
            const queuedIndex = state.queue.findIndex(item => item.input.requestId === normalized.requestId)
            if (queuedIndex >= 0) {
                state.queue.splice(queuedIndex, 1)
            }
        }

        updateQueueState()
        observationRuntime.trimCompletedObservations()
        void startNext()
    }

    const createRunRecord = (
        runInput: RunWorkflowInput,
        actorContext?: ActorExecutionContext,
    ): WorkflowRunRecord => {
        if (state.runsByRequestId.has(runInput.requestId)) {
            throw createDuplicateRequestError(runInput.requestId)
        }

        const workflowRunId = runInput.workflowRunId ?? createWorkflowRunId()
        const run: WorkflowRunRecord = {
            input: {
                ...runInput,
                workflowRunId,
            },
            subject: new Subject<WorkflowObservation>(),
            actorContext,
            started: false,
            settled: false,
        }
        state.runsByRequestId.set(runInput.requestId, run)
        return run
    }

    const startNext = async () => {
        if (state.activeRun || state.queue.length === 0) {
            updateQueueState()
            return
        }

        state.activeRun = state.queue.shift()
        updateQueueState()
        const activeRun = state.activeRun
        if (!activeRun) {
            return
        }

        let definition: WorkflowDefinition
        try {
            definition = definitionResolver.resolveDefinition(activeRun.input.workflowKey)
        } catch (error) {
            settleRun(
                activeRun,
                createFailedObservation({
                    requestId: activeRun.input.requestId,
                    workflowRunId: activeRun.input.workflowRunId!,
                    workflowKey: activeRun.input.workflowKey,
                    error: definitionResolver.toDefinitionError(activeRun.input.workflowKey, error),
                    contextInput: activeRun.input.input,
                }),
            )
            return
        }

        const execution = await executor.runActive(activeRun, definition)
        if (execution.status === 'terminal' && execution.observation) {
            settleRun(activeRun, execution.observation)
            return
        }

        if (execution.status === 'failed-before-start' && execution.error) {
            settleRun(
                activeRun,
                createFailedObservation({
                    requestId: activeRun.input.requestId,
                    workflowRunId: activeRun.input.workflowRunId!,
                    workflowKey: activeRun.input.workflowKey,
                    error: execution.error,
                    contextInput: activeRun.input.input,
                }),
            )
        }
    }

    const launchActiveRun = async (run: WorkflowRunRecord) => {
        let definition: WorkflowDefinition
        try {
            definition = definitionResolver.resolveDefinition(run.input.workflowKey)
        } catch (error) {
            settleRun(
                run,
                createFailedObservation({
                    requestId: run.input.requestId,
                    workflowRunId: run.input.workflowRunId!,
                    workflowKey: run.input.workflowKey,
                    error: definitionResolver.toDefinitionError(run.input.workflowKey, error),
                    contextInput: run.input.input,
                }),
            )
            return
        }

        const execution = await executor.runActive(run, definition)
        if (execution.status === 'terminal' && execution.observation) {
            settleRun(run, execution.observation)
            return
        }

        if (execution.status === 'failed-before-start' && execution.error) {
            settleRun(
                run,
                createFailedObservation({
                    requestId: run.input.requestId,
                    workflowRunId: run.input.workflowRunId!,
                    workflowKey: run.input.workflowKey,
                    error: execution.error,
                    contextInput: run.input.input,
                }),
            )
        }
    }

    const enqueue = (run: WorkflowRunRecord) => {
        if (run.started) {
            return
        }
        run.started = true

        if (state.queue.length >= config.getQueueSizeLimit()) {
            throw definitionResolver.toDefinitionError(
                run.input.workflowKey,
                new Error('workflow queue size limit exceeded'),
            )
        }

        if (state.activeRun || state.queue.length > 0) {
            state.queue.push(run)
            observationRuntime.notify(
                patchObservation(
                    createInitialObservation({
                        requestId: run.input.requestId,
                        workflowRunId: run.input.workflowRunId!,
                        workflowKey: run.input.workflowKey,
                        status: 'WAITING_IN_QUEUE',
                        contextInput: run.input.input,
                    }),
                    {
                        queuePosition: state.queue.length,
                    },
                    createWorkflowEvent({
                        requestId: run.input.requestId,
                        workflowRunId: run.input.workflowRunId!,
                        type: 'workflow.waiting',
                    }),
                ),
            )
            updateQueueState()
            return
        }

        state.activeRun = run
        updateQueueState()
        void launchActiveRun(run)
    }

    const cancel = (cancelInput: CancelWorkflowRunInput) => {
        const requestId = cancelInput.requestId
            ?? [...state.runsByRequestId.keys()].find(id => {
                const observation = selectWorkflowObservationByRequestId(context.getState(), id)
                return observation?.workflowRunId === cancelInput.workflowRunId
            })

        if (!requestId) {
            return
        }

        const queuedIndex = state.queue.findIndex(item => item.input.requestId === requestId)
        const run = queuedIndex >= 0
            ? state.queue[queuedIndex]
            : state.activeRun?.input.requestId === requestId
                ? state.activeRun
                : undefined
        const current = selectWorkflowObservationByRequestId(context.getState(), requestId)
        if (!run || !current) {
            return
        }

        const cancelledAt = nowTimestampMs()
        settleRun(
            run,
            patchObservation(
                current,
                {
                    status: 'CANCELLED',
                    cancelledAt,
                    completedAt: cancelledAt,
                    updatedAt: cancelledAt,
                },
                createWorkflowEvent({
                    requestId: current.requestId,
                    workflowRunId: current.workflowRunId,
                    type: 'workflow.cancelled',
                    payload: {reason: cancelInput.reason},
                    occurredAt: cancelledAt,
                }),
            ),
        )
    }

    const runtime: WorkflowRuntimeFacadeV2 = {
        run$(runInput) {
            return new Observable<WorkflowObservation>(subscriber => {
                let run: WorkflowRunRecord
                try {
                    run = createRunRecord(runInput)
                } catch (error) {
                    subscriber.error(error)
                    return () => undefined
                }

                const subscription = run.subject.subscribe(subscriber)
                try {
                    enqueue(run)
                    const current = selectWorkflowObservationByRequestId(context.getState(), run.input.requestId)
                    if (current) {
                        subscriber.next(cloneObservation(current))
                        if (isTerminalObservation(current)) {
                            subscriber.complete()
                        }
                    }
                } catch (error) {
                    subscription.unsubscribe()
                    state.runsByRequestId.delete(run.input.requestId)
                    subscriber.error(error)
                }
                return () => subscription.unsubscribe()
            })
        },
        cancel,
        getObservation(requestId) {
            return selectWorkflowObservationByRequestId(context.getState(), requestId)
        },
        async registerDefinitions(inputValue) {
            context.dispatchAction(workflowRuntimeV2StateActions.registerDefinitions(inputValue))
        },
        async removeDefinition(inputValue) {
            context.dispatchAction(workflowRuntimeV2StateActions.removeDefinition(inputValue))
        },
    }

    registry.runtime = runtime

    return {
        runtime,
        async runFromCommand(runInput, actorContext) {
            const run = createRunRecord(runInput, actorContext)
            const terminalPromise = createTerminalPromise(run)
            enqueue(run)
            const terminal = await terminalPromise
            return toTerminalSummary(terminal)
        },
        registerDefinitions(definitions, source) {
            context.dispatchAction(workflowRuntimeV2StateActions.registerDefinitions({
                definitions,
                source,
                updatedAt: nowTimestampMs(),
            }))
        },
        removeDefinition(removeInput) {
            context.dispatchAction(workflowRuntimeV2StateActions.removeDefinition(removeInput))
        },
        cancel,
    }
}
