import {setTimeout as delay} from 'node:timers/promises'
import {Observable, Subject} from 'rxjs'
import {
    createAppError,
    nowTimestampMs,
    type RequestId,
} from '@impos2/kernel-base-contracts'
import {
    selectRuntimeShellV2ParameterCatalog,
    type ActorExecutionContext,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    RunWorkflowInput,
    RunWorkflowSummary,
    WorkflowDefinition,
    WorkflowDefinitionsBySource,
    WorkflowObservation,
    WorkflowRuntimeFacadeV2,
    WorkflowStepDefinition,
    WorkflowStepObservation,
} from '../types'
import {
    workflowRuntimeV2StateActions,
    WORKFLOW_OBSERVATIONS_STATE_KEY,
} from '../features/slices'
import {
    selectWorkflowDefinitionsBySource,
    selectWorkflowObservationByRequestId,
} from '../selectors'
import {workflowRuntimeV2ParameterDefinitions} from '../supports'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'
import {
    createDefinitionDisabledError,
    createDefinitionNotFoundError,
    createDuplicateRequestError,
    createExecutionFailedError,
    createInitialObservation,
    createStepFailedError,
    createWorkflowStepRunId,
    createWorkflowEvent,
    createWorkflowRunId,
    patchObservation,
    toWorkflowErrorView,
} from './defaults'
import {
    hasOnlyDisabledDefinitionsBySource,
    resolveWorkflowDefinitionFromSources,
} from './definitionResolver'
import {
    applyWorkflowOutput,
    evaluateWorkflowCondition,
    resolveWorkflowInput,
} from './scriptRuntime'
import {
    findWorkflowStep,
    getProgressTotal,
    resolveWorkflowOutput,
} from './engineStep'
import {
    executeWorkflowStepRawOutput,
    type ResolvedWorkflowStepInput,
} from './engineStepExecutor'
import {
    markStepCompensating,
    markStepCompleted,
    markStepFailed,
    markStepRetrying,
    markStepSkipped,
    markStepStarted,
} from './engineTransitions'
import {
    cloneObservation,
    isTerminalObservation,
    isTimeoutError,
    toParameterNumber,
    toTerminalSummary,
    trimEvents,
    withTimeout,
} from './engineObservation'
import {
    collectRetainedRequestIds,
    createTerminalPromise,
    type WorkflowRunRecord,
} from './engineRunState'
import type {WorkflowRuntimeRegistryRecord} from './runtime'

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
    cancel(input: {requestId?: RequestId; workflowRunId?: WorkflowObservation['workflowRunId']; reason?: string}): void
} => {
    const {context, registry, runtimePlatform} = input
    const observersByRequestId = new Map<string, Set<Subject<WorkflowObservation>>>()
    const queue: WorkflowRunRecord[] = []
    const runsByRequestId = new Map<RequestId, WorkflowRunRecord>()
    let activeRun: WorkflowRunRecord | undefined

    const getParameterCatalog = () =>
        selectRuntimeShellV2ParameterCatalog(context.getState())

    const getEventHistoryLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.eventHistoryLimit.key,
            workflowRuntimeV2ParameterDefinitions.eventHistoryLimit.defaultValue,
        )

    const getQueueSizeLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.queueSizeLimit.key,
            workflowRuntimeV2ParameterDefinitions.queueSizeLimit.defaultValue,
        )

    const getCompletedObservationLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.completedObservationLimit.key,
            workflowRuntimeV2ParameterDefinitions.completedObservationLimit.defaultValue,
        )

    const normalizeObservation = (observation: WorkflowObservation): WorkflowObservation => ({
        ...cloneObservation(observation),
        events: trimEvents(observation.events, getEventHistoryLimit()),
    })

    const notify = (observation: WorkflowObservation) => {
        const normalized = normalizeObservation(observation)
        context.dispatchAction(workflowRuntimeV2StateActions.putObservation(normalized))
        runsByRequestId.get(normalized.requestId)?.subject.next(cloneObservation(normalized))
        const subjects = observersByRequestId.get(normalized.requestId)
        if (!subjects) {
            return
        }

        subjects.forEach(subject => {
            subject.next(cloneObservation(normalized))
            if (isTerminalObservation(normalized)) {
                subject.complete()
            }
        })

        if (isTerminalObservation(normalized)) {
            runsByRequestId.get(normalized.requestId)?.subject.complete()
        }

        if (isTerminalObservation(normalized)) {
            observersByRequestId.delete(normalized.requestId)
        }
    }

    const trimCompletedObservations = () => {
        const limit = getCompletedObservationLimit()
        const observations =
            (
                context.getState()[WORKFLOW_OBSERVATIONS_STATE_KEY as keyof ReturnType<RuntimeModuleContextV2['getState']>] as
                    | {byRequestId: Record<string, WorkflowObservation>}
                    | undefined
            )?.byRequestId ?? {}
        const activeRequestIds = new Set<RequestId>([
            ...queue.map(item => item.input.requestId),
            ...(activeRun ? [activeRun.input.requestId] : []),
        ])
        const retainRequestIds = collectRetainedRequestIds({
            observations,
            activeRequestIds,
            completedObservationLimit: limit,
        })

        if (retainRequestIds.length === Object.keys(observations).length) {
            return
        }

        context.dispatchAction(workflowRuntimeV2StateActions.trimTerminalObservations({
            retainRequestIds,
            updatedAt: nowTimestampMs(),
        }))
    }

    registry.addObserver = (requestId, listener) => {
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

    const updateQueueState = () => {
        const updatedAt = nowTimestampMs()
        context.dispatchAction(workflowRuntimeV2StateActions.setActiveRequest({
            requestId: activeRun?.input.requestId,
            updatedAt,
        }))
        context.dispatchAction(workflowRuntimeV2StateActions.replaceQueuedRequests({
            requestIds: queue.map(item => item.input.requestId),
            updatedAt,
        }))

        queue.forEach((item, index) => {
            const current = selectWorkflowObservationByRequestId(context.getState(), item.input.requestId)
            if (!current || isTerminalObservation(current)) {
                return
            }
            notify({
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
        const normalized = normalizeObservation(observation)
        notify(normalized)
        run.subject.complete()
        run.resolveTerminal?.(cloneObservation(normalized))
        runsByRequestId.delete(normalized.requestId)

        if (activeRun?.input.requestId === normalized.requestId) {
            activeRun = undefined
        } else {
            const queuedIndex = queue.findIndex(item => item.input.requestId === normalized.requestId)
            if (queuedIndex >= 0) {
                queue.splice(queuedIndex, 1)
            }
        }

        updateQueueState()
        trimCompletedObservations()
        void startNext()
    }

    const createFailedObservation = (failure: {
        requestId: RequestId
        workflowRunId: WorkflowObservation['workflowRunId']
        workflowKey: string
        error: ReturnType<typeof createAppError>
        contextInput?: unknown
    }): WorkflowObservation => {
        const base = createInitialObservation({
            requestId: failure.requestId,
            workflowRunId: failure.workflowRunId,
            workflowKey: failure.workflowKey,
            status: 'RUNNING',
            contextInput: failure.contextInput,
        })
        const failedAt = nowTimestampMs()
        const error = toWorkflowErrorView(failure.error)!
        return patchObservation(
            base,
            {
                status: 'FAILED',
                error,
                completedAt: failedAt,
                updatedAt: failedAt,
            },
            createWorkflowEvent({
                requestId: failure.requestId,
                workflowRunId: base.workflowRunId,
                type: 'workflow.failed',
                error,
                occurredAt: failedAt,
            }),
        )
    }

    const failBeforeStart = (
        run: WorkflowRunRecord,
        error: ReturnType<typeof createAppError>,
    ) => {
        settleRun(run, createFailedObservation({
            requestId: run.input.requestId,
            workflowRunId: run.input.workflowRunId ?? createWorkflowRunId(),
            workflowKey: run.input.workflowKey,
            error,
            contextInput: run.input.input,
        }))
    }

    const toAppError = (
        error: unknown,
        stepKey: string,
    ): ReturnType<typeof createAppError> => {
        if (typeof error === 'object' && error !== null && 'key' in error && 'message' in error) {
            return error as ReturnType<typeof createAppError>
        }
        return createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey},
            details: error,
            cause: error,
        })
    }

    const resolveDefinition = (workflowKey: string) => {
        const bySource = selectWorkflowDefinitionsBySource(context.getState()) as WorkflowDefinitionsBySource | undefined
        const resolved = resolveWorkflowDefinitionFromSources(bySource, workflowKey, runtimePlatform)
        if (resolved) {
            if (!resolved.enabled) {
                throw createDefinitionDisabledError(workflowKey)
            }
            return resolved
        }
        if (hasOnlyDisabledDefinitionsBySource(bySource, workflowKey)) {
            throw createDefinitionDisabledError(workflowKey)
        }
        throw createDefinitionNotFoundError(workflowKey)
    }

    const resolveWorkflowTimeoutMs = (
        definition: WorkflowDefinition,
        run: WorkflowRunRecord,
    ): number | undefined => {
        const runtimeOptionTimeout = run.input.options?.timeoutMs
        if (typeof runtimeOptionTimeout === 'number' && runtimeOptionTimeout > 0) {
            return runtimeOptionTimeout
        }

        const defaultOptionTimeout = definition.defaultOptions?.timeoutMs
        if (typeof defaultOptionTimeout === 'number' && defaultOptionTimeout > 0) {
            return defaultOptionTimeout
        }

        if (typeof definition.timeoutMs === 'number' && definition.timeoutMs > 0) {
            return definition.timeoutMs
        }

        return toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.defaultWorkflowTimeoutMs.key,
            workflowRuntimeV2ParameterDefinitions.defaultWorkflowTimeoutMs.defaultValue,
        )
    }

    const resolveStepTimeoutMs = (step: WorkflowStepDefinition): number | undefined => {
        if (typeof step.timeoutMs === 'number' && step.timeoutMs > 0) {
            return step.timeoutMs
        }

        return toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.defaultStepTimeoutMs.key,
            workflowRuntimeV2ParameterDefinitions.defaultStepTimeoutMs.defaultValue,
        )
    }

    const createTimedOutObservation = (timeout: {
        observation: WorkflowObservation
        stepKey?: string
        stepRunId?: WorkflowStepObservation['stepRunId']
        appError: ReturnType<typeof createAppError>
    }): WorkflowObservation => {
        const timedOutAt = nowTimestampMs()
        const errorView = toWorkflowErrorView(timeout.appError)!
        let nextObservation = patchObservation(
            timeout.observation,
            {
                status: 'TIMED_OUT',
                error: errorView,
                timedOutAt,
                completedAt: timedOutAt,
                updatedAt: timedOutAt,
            },
            ...(
                timeout.stepKey
                    ? [createWorkflowEvent({
                        requestId: timeout.observation.requestId,
                        workflowRunId: timeout.observation.workflowRunId,
                        stepKey: timeout.stepKey,
                        type: 'step.timed-out',
                        error: errorView,
                        occurredAt: timedOutAt,
                    })]
                    : []
            ),
        )

        if (timeout.stepKey) {
            nextObservation = patchObservation(nextObservation, {
                steps: {
                    ...nextObservation.steps,
                    [timeout.stepKey]: {
                        ...nextObservation.steps[timeout.stepKey],
                        status: 'TIMED_OUT',
                        error: errorView,
                        completedAt: timedOutAt,
                        updatedAt: timedOutAt,
                    },
                },
            })
        }

        return patchObservation(
            nextObservation,
            {},
            createWorkflowEvent({
                requestId: timeout.observation.requestId,
                workflowRunId: timeout.observation.workflowRunId,
                type: 'workflow.timed-out',
                error: errorView,
                occurredAt: timedOutAt,
            }),
        )
    }

    const executeLeafStep = async (
        run: WorkflowRunRecord,
        definition: WorkflowDefinition,
        observation: WorkflowObservation,
        step: WorkflowStepDefinition,
        progress: {current: number; total: number},
    ): Promise<WorkflowObservation> => {
        if (run.settled) {
            return selectWorkflowObservationByRequestId(context.getState(), run.input.requestId) ?? observation
        }

        const stepRunId = createWorkflowStepRunId()
        let nextObservation = markStepStarted({
            observation,
            step,
            stepRunId,
            progressTotal: progress.total,
        })
        notify(nextObservation)

        try {
            const conditionPassed = await evaluateWorkflowCondition({
                platformPorts: context.platformPorts,
                expression: step.condition,
                context: nextObservation.context,
            })

            if (!conditionPassed) {
                nextObservation = markStepSkipped({
                    observation: nextObservation,
                    step,
                    progress,
                })
                notify(nextObservation)
                return nextObservation
            }

            let rawOutput: unknown = {}
            const stepInput = await resolveWorkflowInput({
                platformPorts: context.platformPorts,
                mapping: step.input,
                context: nextObservation.context,
            }) as ResolvedWorkflowStepInput | undefined

            let attempt = 0
            const maxRetries = step.strategy?.onError === 'retry'
                ? (step.strategy.retry?.times ?? 0)
                : 0
            const resolvedStepTimeoutMs = resolveStepTimeoutMs(step)

            while (true) {
                try {
                    rawOutput = await executeWorkflowStepRawOutput({
                        run,
                        step,
                        stepInput,
                        resolvedStepTimeoutMs,
                        platformPorts: context.platformPorts,
                    })
                    break
                } catch (error) {
                    if (attempt < maxRetries) {
                        attempt += 1
                        nextObservation = markStepRetrying({
                            observation: nextObservation,
                            step,
                            attempt,
                            maxRetries,
                        })
                        notify(nextObservation)
                        if (step.strategy?.retry?.intervalMs) {
                            await delay(step.strategy.retry.intervalMs)
                        }
                        continue
                    }
                    throw error
                }
            }

            if (run.settled) {
                return selectWorkflowObservationByRequestId(context.getState(), run.input.requestId) ?? nextObservation
            }

            const outputResolution = await applyWorkflowOutput({
                platformPorts: context.platformPorts,
                mapping: step.output,
                rawOutput,
                context: nextObservation.context,
            })

            nextObservation = markStepCompleted({
                observation: nextObservation,
                step,
                progress,
                output: outputResolution.output,
                variablesPatch: outputResolution.variablesPatch,
            })
            notify(nextObservation)
            return nextObservation
        } catch (error) {
            if (run.settled) {
                return selectWorkflowObservationByRequestId(context.getState(), run.input.requestId) ?? nextObservation
            }

            const appError = toAppError(error, step.stepKey)
            const errorView = toWorkflowErrorView(appError)!
            const failedAt = nowTimestampMs()

            if (step.strategy?.onError === 'skip') {
                nextObservation = markStepSkipped({
                    observation: nextObservation,
                    step,
                    progress,
                    error: errorView,
                })
                notify(nextObservation)
                return nextObservation
            }

            if (step.strategy?.onError === 'compensate' && step.strategy.compensationStepKey) {
                const compensationStep = findWorkflowStep(definition.rootStep, step.strategy.compensationStepKey)
                if (compensationStep && compensationStep.stepKey !== step.stepKey) {
                    nextObservation = markStepCompensating({
                        observation: nextObservation,
                        step,
                        compensationStepKey: compensationStep.stepKey,
                        error: errorView,
                    })
                    notify(nextObservation)

                    const compensatedObservation = await executeStep(
                        run,
                        definition,
                        nextObservation,
                        compensationStep,
                        progress,
                    )

                    if (compensatedObservation.status === 'TIMED_OUT') {
                        return compensatedObservation
                    }

                    return markStepFailed({
                        observation: compensatedObservation,
                        step,
                        error: errorView,
                    })
                }
            }

            if (isTimeoutError(appError)) {
                return createTimedOutObservation({
                    observation: nextObservation,
                    stepKey: step.stepKey,
                    stepRunId,
                    appError,
                })
            }

            return markStepFailed({
                observation: nextObservation,
                step,
                error: errorView,
                completedAt: failedAt,
            })
        }
    }

    const executeStep = async (
        run: WorkflowRunRecord,
        definition: WorkflowDefinition,
        observation: WorkflowObservation,
        step: WorkflowStepDefinition,
        progress: {current: number; total: number},
    ): Promise<WorkflowObservation> => {
        if (step.type === 'flow') {
            let nextObservation = observation
            for (const child of step.steps ?? []) {
                nextObservation = await executeStep(run, definition, nextObservation, child, progress)
                if (nextObservation.status === 'FAILED' || nextObservation.status === 'TIMED_OUT') {
                    return nextObservation
                }
            }
            return nextObservation
        }
        return await executeLeafStep(run, definition, observation, step, progress)
    }

    const runActive = async (run: WorkflowRunRecord) => {
        let definition: WorkflowDefinition
        try {
            definition = resolveDefinition(run.input.workflowKey)
        } catch (error) {
            failBeforeStart(
                run,
                typeof error === 'object' && error !== null && 'key' in error
                    ? error as ReturnType<typeof createAppError>
                    : createExecutionFailedError(run.input.workflowKey, error),
            )
            return
        }

        let observation = selectWorkflowObservationByRequestId(context.getState(), run.input.requestId)
            ?? createInitialObservation({
                requestId: run.input.requestId,
                workflowRunId: run.input.workflowRunId ?? createWorkflowRunId(),
                workflowKey: run.input.workflowKey,
                status: 'RUNNING',
                contextInput: run.input.input,
            })

        const startedAt = nowTimestampMs()
        observation = patchObservation(
            observation,
            {
                status: 'RUNNING',
                queuePosition: undefined,
                startedAt,
                updatedAt: startedAt,
            },
            createWorkflowEvent({
                requestId: run.input.requestId,
                workflowRunId: observation.workflowRunId,
                type: 'workflow.started',
                occurredAt: startedAt,
            }),
        )
        notify(observation)

        const progress = {
            current: 0,
            total: getProgressTotal(definition.rootStep),
        }
        const workflowTimeoutMs = resolveWorkflowTimeoutMs(definition, run)

        try {
            const executed = await withTimeout({
                promise: executeStep(run, definition, observation, definition.rootStep, progress),
                timeoutMs: workflowTimeoutMs,
                stepKey: definition.rootStep.stepKey,
                type: 'workflow',
            })

            if (run.settled) {
                return
            }

            if (executed.status === 'FAILED' || executed.status === 'TIMED_OUT') {
                settleRun(run, executed)
                return
            }

            const completedAt = nowTimestampMs()
            settleRun(
                run,
                patchObservation(
                    executed,
                    {
                        status: 'COMPLETED',
                        completedAt,
                        output: resolveWorkflowOutput(definition, executed),
                        progress: {
                            current: progress.total,
                            total: progress.total,
                            percent: 100,
                        },
                        updatedAt: completedAt,
                    },
                    createWorkflowEvent({
                        requestId: run.input.requestId,
                        workflowRunId: executed.workflowRunId,
                        type: 'workflow.completed',
                        occurredAt: completedAt,
                    }),
                ),
            )
        } catch (error) {
            if (run.settled) {
                return
            }
            const appError = toAppError(error, definition.rootStep.stepKey)
            if (isTimeoutError(appError)) {
                settleRun(run, createTimedOutObservation({
                    observation,
                    stepKey: definition.rootStep.stepKey,
                    appError,
                }))
                return
            }
            failBeforeStart(run, appError)
        }
    }

    const startNext = async () => {
        if (activeRun || queue.length === 0) {
            updateQueueState()
            return
        }
        activeRun = queue.shift()
        updateQueueState()
        if (!activeRun) {
            return
        }
        await runActive(activeRun)
    }

    const enqueue = (run: WorkflowRunRecord) => {
        if (run.started) {
            return
        }
        run.started = true

        if (queue.length >= getQueueSizeLimit()) {
            throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowQueueCorrupted, {
                details: {
                    reason: 'queue-size-limit-exceeded',
                    queueSize: queue.length,
                },
            })
        }

        if (activeRun || queue.length > 0) {
            queue.push(run)
            const observation = createInitialObservation({
                requestId: run.input.requestId,
                workflowRunId: run.input.workflowRunId ?? createWorkflowRunId(),
                workflowKey: run.input.workflowKey,
                status: 'WAITING_IN_QUEUE',
                contextInput: run.input.input,
            })
            notify({
                ...observation,
                queuePosition: queue.length,
            })
            updateQueueState()
            return
        }

        activeRun = run
        updateQueueState()
        void runActive(run)
    }

    const createRunRecord = (
        runInput: RunWorkflowInput,
        actorContext?: ActorExecutionContext,
    ): WorkflowRunRecord => {
        if (runsByRequestId.has(runInput.requestId)) {
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
        runsByRequestId.set(runInput.requestId, run)
        return run
    }

    const runtime: WorkflowRuntimeFacadeV2 = {
        run$(runInput) {
            const run = createRunRecord(runInput)
            return new Observable<WorkflowObservation>(subscriber => {
                const subscription = run.subject.subscribe(subscriber)
                enqueue(run)
                const current = selectWorkflowObservationByRequestId(context.getState(), run.input.requestId)
                if (current) {
                    subscriber.next(cloneObservation(current))
                    if (isTerminalObservation(current)) {
                        subscriber.complete()
                    }
                }
                return () => subscription.unsubscribe()
            })
        },
        cancel(cancelInput) {
            const requestId = cancelInput.requestId
                ?? [...runsByRequestId.keys()].find(id => {
                    const observation = selectWorkflowObservationByRequestId(context.getState(), id)
                    return observation?.workflowRunId === cancelInput.workflowRunId
                })

            if (!requestId) {
                return
            }

            const queuedIndex = queue.findIndex(item => item.input.requestId === requestId)
            const run = queuedIndex >= 0
                ? queue[queuedIndex]
                : activeRun?.input.requestId === requestId
                    ? activeRun
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
        },
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
        cancel(inputValue) {
            runtime.cancel(inputValue)
        },
    }
}
