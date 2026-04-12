import {setTimeout as delay} from 'node:timers/promises'
import {Observable, Subject} from 'rxjs'
import {
    createAppError,
    nowTimestampMs,
    type ParameterCatalogEntry,
    type RequestId,
} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    selectRuntimeShellV2ParameterCatalog,
    type ActorExecutionContext,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    RunWorkflowInput,
    RunWorkflowSummary,
    WorkflowContextSnapshot,
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowRuntimeFacadeV2,
    WorkflowStepDefinition,
    WorkflowStepObservation,
} from '../types'
import {workflowRuntimeV2StateActions} from '../features/slices'
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
    createStepObservation,
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
    executeExternalCall,
    executeExternalOn,
    executeExternalSubscribe,
} from './connectorRuntime'
import type {WorkflowRuntimeRegistryRecord} from './runtime'

interface RunRecord {
    input: RunWorkflowInput
    subject: Subject<WorkflowObservation>
    actorContext?: ActorExecutionContext
    started: boolean
    settled: boolean
    resolveTerminal?: (observation: WorkflowObservation) => void
    rejectTerminal?: (error: unknown) => void
}

const terminalStatuses = new Set<WorkflowObservation['status']>([
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMED_OUT',
])

const cloneObservation = (observation: WorkflowObservation): WorkflowObservation => ({
    ...observation,
    progress: {...observation.progress},
    context: {
        ...observation.context,
        variables: {...observation.context.variables},
        stepOutputs: {...observation.context.stepOutputs},
    },
    steps: Object.fromEntries(
        Object.entries(observation.steps).map(([stepKey, step]) => [stepKey, {...step}]),
    ),
    events: [...observation.events],
})

const trimEvents = (
    events: readonly WorkflowObservation['events'][number][],
    limit: number,
) => {
    if (limit <= 0 || events.length <= limit) {
        return [...events]
    }
    return events.slice(events.length - limit)
}

const toTerminalSummary = (observation: WorkflowObservation): RunWorkflowSummary => ({
    requestId: observation.requestId,
    workflowRunId: observation.workflowRunId,
    workflowKey: observation.workflowKey,
    status: observation.status as RunWorkflowSummary['status'],
    result: {
        output: observation.output,
        variables: observation.context.variables,
        stepOutputs: observation.context.stepOutputs,
    },
    error: observation.error,
    completedAt: observation.completedAt,
})

const isTerminalObservation = (observation: WorkflowObservation) =>
    terminalStatuses.has(observation.status)

const isTimeoutError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error == null || !('details' in error)) {
        return false
    }

    const details = (error as {details?: unknown}).details
    if (typeof details !== 'object' || details == null || !('reason' in details)) {
        return false
    }

    const reason = (details as {reason?: unknown}).reason
    return reason === 'step-timeout' || reason === 'workflow-timeout' || reason === 'timeout'
}

const withTimeout = async <T>(input: {
    promise: Promise<T>
    timeoutMs?: number
    stepKey: string
    type: 'step' | 'workflow'
}): Promise<T> => {
    if (!input.timeoutMs || input.timeoutMs <= 0) {
        return input.promise
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            input.promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(createAppError(
                        workflowRuntimeV2ErrorDefinitions.workflowStepFailed,
                        {
                            args: {stepKey: input.stepKey},
                            details: {
                                reason: `${input.type}-timeout`,
                                timeoutMs: input.timeoutMs,
                            },
                        },
                    ))
                }, input.timeoutMs)
            }),
        ])
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }
}

const getProgressTotal = (step: WorkflowStepDefinition): number => {
    if (step.type !== 'flow' || !step.steps?.length) {
        return 1
    }
    return step.steps.reduce((sum, child) => sum + getProgressTotal(child), 0)
}

const findWorkflowStep = (
    step: WorkflowStepDefinition,
    stepKey: string,
): WorkflowStepDefinition | undefined => {
    if (step.stepKey === stepKey) {
        return step
    }
    for (const child of step.steps ?? []) {
        const matched = findWorkflowStep(child, stepKey)
        if (matched) {
            return matched
        }
    }
    return undefined
}

const resolveWorkflowOutput = (
    definition: WorkflowDefinition,
    observation: WorkflowObservation,
): unknown => {
    const rootOutput = observation.context.stepOutputs[definition.rootStep.stepKey]
    if (rootOutput !== undefined) {
        return rootOutput
    }

    if (definition.rootStep.type === 'flow') {
        const completedChild = [...(definition.rootStep.steps ?? [])]
            .reverse()
            .find(child => observation.steps[child.stepKey]?.status === 'COMPLETED')
        if (completedChild) {
            return observation.context.stepOutputs[completedChild.stepKey]
        }
    }

    return observation.output
}

const aggregateCommandStepOutput = (result: Awaited<ReturnType<ActorExecutionContext['dispatchCommand']>>) => {
    const completedActorResults = result.actorResults
        .filter(item => item.status === 'COMPLETED')
        .map(item => ({
            actorKey: item.actorKey,
            result: item.result,
        }))

    if (completedActorResults.length === 1) {
        return completedActorResults[0]?.result
    }

    return {
        status: result.status,
        actorResults: completedActorResults,
    }
}

const createTerminalPromise = (
    run: RunRecord,
): Promise<WorkflowObservation> => {
    return new Promise<WorkflowObservation>((resolve, reject) => {
        run.resolveTerminal = resolve
        run.rejectTerminal = reject
    })
}

const toParameterNumber = (
    catalog: Record<string, ParameterCatalogEntry>,
    key: string,
    fallback: number,
): number => {
    const raw = catalog[key]?.rawValue
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? raw
        : fallback
}

export const createWorkflowEngineV2 = (input: {
    context: RuntimeModuleContextV2
    registry: WorkflowRuntimeRegistryRecord
}): {
    runtime: WorkflowRuntimeFacadeV2
    runFromCommand(
        runInput: RunWorkflowInput,
        actorContext: ActorExecutionContext,
    ): Promise<RunWorkflowSummary>
    registerDefinitions(definitions: WorkflowDefinition[], source: 'module' | 'host' | 'remote' | 'test'): void
    removeDefinition(input: {workflowKey: string; definitionId?: string; source?: 'module' | 'host' | 'remote' | 'test'}): void
    cancel(input: {requestId?: RequestId; workflowRunId?: string; reason?: string}): void
} => {
    const {context, registry} = input
    const observersByRequestId = new Map<string, Set<Subject<WorkflowObservation>>>()
    const queue: RunRecord[] = []
    const runsByRequestId = new Map<RequestId, RunRecord>()
    let activeRun: RunRecord | undefined

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
            const current = selectWorkflowObservationByRequestId(context.getState() as any, item.input.requestId)
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

    const settleRun = (run: RunRecord, observation: WorkflowObservation) => {
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
        void startNext()
    }

    const createFailedObservation = (failure: {
        requestId: RequestId
        workflowRunId: string
        workflowKey: string
        error: ReturnType<typeof createAppError>
        contextInput?: unknown
    }): WorkflowObservation => {
        const base = createInitialObservation({
            requestId: failure.requestId,
            workflowRunId: failure.workflowRunId as any,
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
        run: RunRecord,
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
        const bySource = selectWorkflowDefinitionsBySource(context.getState() as any)
        const resolved = resolveWorkflowDefinitionFromSources(bySource, workflowKey)
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
        run: RunRecord,
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
        run: RunRecord,
        definition: WorkflowDefinition,
        observation: WorkflowObservation,
        step: WorkflowStepDefinition,
        progress: {current: number; total: number},
    ): Promise<WorkflowObservation> => {
        if (run.settled) {
            return selectWorkflowObservationByRequestId(context.getState() as any, run.input.requestId) ?? observation
        }

        const stepRunId = createWorkflowRunId() as unknown as WorkflowStepObservation['stepRunId']
        const startedAt = nowTimestampMs()
        let nextObservation = patchObservation(
            observation,
            {
                status: 'RUNNING',
                progress: {
                    ...observation.progress,
                    total: progress.total,
                    activeStepKey: step.stepKey,
                },
                steps: {
                    ...observation.steps,
                    [step.stepKey]: {
                        ...createStepObservation(step),
                        stepRunId,
                        status: 'RUNNING',
                        startedAt,
                        updatedAt: startedAt,
                    },
                },
                updatedAt: startedAt,
            },
            createWorkflowEvent({
                requestId: run.input.requestId,
                workflowRunId: observation.workflowRunId,
                stepKey: step.stepKey,
                type: 'step.started',
                occurredAt: startedAt,
            }),
        )
        notify(nextObservation)

        try {
            const conditionPassed = await evaluateWorkflowCondition({
                platformPorts: context.platformPorts,
                expression: step.condition,
                context: nextObservation.context,
            })

            if (!conditionPassed) {
                progress.current += 1
                const skippedAt = nowTimestampMs()
                nextObservation = patchObservation(
                    nextObservation,
                    {
                        progress: {
                            current: progress.current,
                            total: progress.total,
                            percent: progress.total > 0
                                ? Math.round((progress.current / progress.total) * 100)
                                : 100,
                            activeStepKey: step.stepKey,
                        },
                        steps: {
                            ...nextObservation.steps,
                            [step.stepKey]: {
                                ...nextObservation.steps[step.stepKey],
                                status: 'SKIPPED',
                                completedAt: skippedAt,
                                updatedAt: skippedAt,
                            },
                        },
                        updatedAt: skippedAt,
                    },
                    createWorkflowEvent({
                        requestId: run.input.requestId,
                        workflowRunId: nextObservation.workflowRunId,
                        stepKey: step.stepKey,
                        type: 'step.skipped',
                        occurredAt: skippedAt,
                    }),
                )
                notify(nextObservation)
                return nextObservation
            }

            let rawOutput: unknown = {}
            const stepInput = await resolveWorkflowInput({
                platformPorts: context.platformPorts,
                mapping: step.input,
                context: nextObservation.context,
            }) as {
                commandName?: string
                payload?: unknown
                output?: unknown
                delayMs?: number
                channel?: Record<string, unknown>
                action?: string
                eventType?: string
                timeoutMs?: number
                target?: string
                params?: Record<string, unknown>
            } | undefined

            let attempt = 0
            const maxRetries = step.strategy?.onError === 'retry'
                ? (step.strategy.retry?.times ?? 0)
                : 0
            const resolvedStepTimeoutMs = resolveStepTimeoutMs(step)

            while (true) {
                try {
                    if (step.type === 'command') {
                        const commandInput = stepInput
                        const commandName = commandInput?.commandName
                        if (!commandName) {
                            throw createStepFailedError(step.stepKey, {reason: 'missing commandName'})
                        }
                        if (!run.actorContext) {
                            throw createStepFailedError(step.stepKey, {reason: 'missing actor context'})
                        }

                        const result = await withTimeout({
                            promise: run.actorContext.dispatchCommand(createCommand({
                                moduleName: commandName.split('.').slice(0, -1).join('.') || 'external',
                                commandName,
                                visibility: 'public',
                                timeoutMs: 60_000,
                                allowNoActor: false,
                                allowReentry: false,
                                defaultTarget: 'local',
                            }, commandInput?.payload ?? {})),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })

                        if (result.status === 'FAILED' || result.status === 'PARTIAL_FAILED' || result.status === 'TIMEOUT') {
                            throw createStepFailedError(step.stepKey, result)
                        }
                        rawOutput = aggregateCommandStepOutput(result)
                    } else if (step.type === 'external-call') {
                        rawOutput = await withTimeout({
                            promise: executeExternalCall({
                                platformPorts: context.platformPorts,
                                stepKey: step.stepKey,
                                payload: stepInput,
                            }),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })
                    } else if (step.type === 'external-subscribe') {
                        rawOutput = await withTimeout({
                            promise: executeExternalSubscribe({
                                platformPorts: context.platformPorts,
                                stepKey: step.stepKey,
                                payload: stepInput,
                            }),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })
                    } else if (step.type === 'external-on') {
                        rawOutput = await withTimeout({
                            promise: executeExternalOn({
                                platformPorts: context.platformPorts,
                                stepKey: step.stepKey,
                                payload: stepInput,
                            }),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })
                    } else {
                        rawOutput = await withTimeout({
                            promise: (async () => {
                                if (typeof stepInput?.delayMs === 'number' && stepInput.delayMs > 0) {
                                    await delay(stepInput.delayMs)
                                }
                                return stepInput?.output ?? stepInput ?? {}
                            })(),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })
                    }
                    break
                } catch (error) {
                    if (attempt < maxRetries) {
                        attempt += 1
                        const retryAt = nowTimestampMs()
                        nextObservation = patchObservation(
                            nextObservation,
                            {
                                steps: {
                                    ...nextObservation.steps,
                                    [step.stepKey]: {
                                        ...nextObservation.steps[step.stepKey],
                                        retryCount: attempt,
                                        updatedAt: retryAt,
                                    },
                                },
                                updatedAt: retryAt,
                            },
                            createWorkflowEvent({
                                requestId: run.input.requestId,
                                workflowRunId: nextObservation.workflowRunId,
                                stepKey: step.stepKey,
                                type: 'step.retrying',
                                payload: {
                                    attempt,
                                    maxRetries,
                                },
                                occurredAt: retryAt,
                            }),
                        )
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
                return selectWorkflowObservationByRequestId(context.getState() as any, run.input.requestId) ?? nextObservation
            }

            const outputResolution = await applyWorkflowOutput({
                platformPorts: context.platformPorts,
                mapping: step.output,
                rawOutput,
                context: nextObservation.context,
            })

            progress.current += 1
            const completedAt = nowTimestampMs()
            nextObservation = patchObservation(
                nextObservation,
                {
                    progress: {
                        current: progress.current,
                        total: progress.total,
                        percent: progress.total > 0
                            ? Math.round((progress.current / progress.total) * 100)
                            : 100,
                        activeStepKey: step.stepKey,
                    },
                    steps: {
                        ...nextObservation.steps,
                        [step.stepKey]: {
                            ...nextObservation.steps[step.stepKey],
                            status: 'COMPLETED',
                            output: outputResolution.output,
                            completedAt,
                            updatedAt: completedAt,
                        },
                    },
                    context: {
                        ...nextObservation.context,
                        variables: {
                            ...nextObservation.context.variables,
                            ...outputResolution.variablesPatch,
                        },
                        stepOutputs: {
                            ...nextObservation.context.stepOutputs,
                            [step.stepKey]: outputResolution.output,
                        },
                        updatedAt: completedAt,
                    },
                    updatedAt: completedAt,
                },
                createWorkflowEvent({
                    requestId: run.input.requestId,
                    workflowRunId: nextObservation.workflowRunId,
                    stepKey: step.stepKey,
                    type: 'step.completed',
                    payload: outputResolution.output,
                    occurredAt: completedAt,
                }),
            )
            notify(nextObservation)
            return nextObservation
        } catch (error) {
            if (run.settled) {
                return selectWorkflowObservationByRequestId(context.getState() as any, run.input.requestId) ?? nextObservation
            }

            const appError = toAppError(error, step.stepKey)
            const errorView = toWorkflowErrorView(appError)!
            const failedAt = nowTimestampMs()

            if (step.strategy?.onError === 'skip') {
                progress.current += 1
                nextObservation = patchObservation(
                    nextObservation,
                    {
                        progress: {
                            current: progress.current,
                            total: progress.total,
                            percent: progress.total > 0
                                ? Math.round((progress.current / progress.total) * 100)
                                : 100,
                            activeStepKey: step.stepKey,
                        },
                        steps: {
                            ...nextObservation.steps,
                            [step.stepKey]: {
                                ...nextObservation.steps[step.stepKey],
                                status: 'SKIPPED',
                                error: errorView,
                                completedAt: failedAt,
                                updatedAt: failedAt,
                            },
                        },
                        updatedAt: failedAt,
                    },
                    createWorkflowEvent({
                        requestId: run.input.requestId,
                        workflowRunId: nextObservation.workflowRunId,
                        stepKey: step.stepKey,
                        type: 'step.skipped',
                        error: errorView,
                        occurredAt: failedAt,
                    }),
                )
                notify(nextObservation)
                return nextObservation
            }

            if (step.strategy?.onError === 'compensate' && step.strategy.compensationStepKey) {
                const compensationStep = findWorkflowStep(definition.rootStep, step.strategy.compensationStepKey)
                if (compensationStep && compensationStep.stepKey !== step.stepKey) {
                    const compensatingAt = nowTimestampMs()
                    nextObservation = patchObservation(
                        nextObservation,
                        {
                            steps: {
                                ...nextObservation.steps,
                                [step.stepKey]: {
                                    ...nextObservation.steps[step.stepKey],
                                    status: 'FAILED',
                                    error: errorView,
                                    updatedAt: compensatingAt,
                                },
                            },
                            updatedAt: compensatingAt,
                        },
                        createWorkflowEvent({
                            requestId: run.input.requestId,
                            workflowRunId: nextObservation.workflowRunId,
                            stepKey: step.stepKey,
                            type: 'step.compensating',
                            payload: {
                                compensationStepKey: compensationStep.stepKey,
                            },
                            error: errorView,
                            occurredAt: compensatingAt,
                        }),
                    )
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

                    const finalFailedAt = nowTimestampMs()
                    const failedObservation = patchObservation(
                        compensatedObservation,
                        {
                            status: 'FAILED',
                            error: errorView,
                            completedAt: finalFailedAt,
                            updatedAt: finalFailedAt,
                        },
                        createWorkflowEvent({
                            requestId: run.input.requestId,
                            workflowRunId: compensatedObservation.workflowRunId,
                            stepKey: step.stepKey,
                            type: 'step.failed',
                            error: errorView,
                            occurredAt: finalFailedAt,
                        }),
                    )

                    return patchObservation(
                        failedObservation,
                        {},
                        createWorkflowEvent({
                            requestId: run.input.requestId,
                            workflowRunId: compensatedObservation.workflowRunId,
                            type: 'workflow.failed',
                            error: errorView,
                            occurredAt: finalFailedAt,
                        }),
                    )
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

            nextObservation = patchObservation(
                nextObservation,
                {
                    status: 'FAILED',
                    error: errorView,
                    steps: {
                        ...nextObservation.steps,
                        [step.stepKey]: {
                            ...nextObservation.steps[step.stepKey],
                            status: 'FAILED',
                            error: errorView,
                            updatedAt: failedAt,
                        },
                    },
                    completedAt: failedAt,
                    updatedAt: failedAt,
                },
                createWorkflowEvent({
                    requestId: run.input.requestId,
                    workflowRunId: nextObservation.workflowRunId,
                    stepKey: step.stepKey,
                    type: 'step.failed',
                    error: errorView,
                    occurredAt: failedAt,
                }),
            )

            return patchObservation(
                nextObservation,
                {},
                createWorkflowEvent({
                    requestId: run.input.requestId,
                    workflowRunId: nextObservation.workflowRunId,
                    type: 'workflow.failed',
                    error: errorView,
                    occurredAt: failedAt,
                }),
            )
        }
    }

    const executeStep = async (
        run: RunRecord,
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

    const runActive = async (run: RunRecord) => {
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

        let observation = selectWorkflowObservationByRequestId(context.getState() as any, run.input.requestId)
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

    const enqueue = (run: RunRecord) => {
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
    ): RunRecord => {
        if (runsByRequestId.has(runInput.requestId)) {
            throw createDuplicateRequestError(runInput.requestId)
        }

        const workflowRunId = runInput.workflowRunId ?? createWorkflowRunId()
        const run: RunRecord = {
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
                const current = selectWorkflowObservationByRequestId(context.getState() as any, run.input.requestId)
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
                    const observation = selectWorkflowObservationByRequestId(context.getState() as any, id)
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
            const current = selectWorkflowObservationByRequestId(context.getState() as any, requestId)
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
            return selectWorkflowObservationByRequestId(context.getState() as any, requestId)
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
            runtime.cancel(inputValue as any)
        },
    }
}
