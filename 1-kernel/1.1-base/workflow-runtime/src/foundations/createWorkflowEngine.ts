import {Observable, Subject} from 'rxjs'
import {
    createAppError,
    createCommandId,
    createEnvelopeId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {RequestId} from '@impos2/kernel-base-contracts'
import type {
    KernelRuntimeHandlerContext,
    RuntimeModuleContext,
} from '@impos2/kernel-base-runtime-shell'
import {
    workflowDefinitionsStateActions,
    workflowObservationsStateActions,
    workflowQueueStateActions,
} from '../features/slices'
import {
    selectWorkflowDefinitionsBySource,
    selectWorkflowObservationByRequestId,
} from '../selectors'
import {
    workflowRuntimeErrorDefinitions,
    workflowRuntimeParameterDefinitions,
} from '../supports'
import {
    createDefinitionDisabledError,
    createDefinitionNotFoundError,
    createDuplicateRequestError,
    createInitialObservation,
    createRunNotFoundError,
    createStepFailedError,
    createStepObservation,
    createWorkflowEvent,
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
import type {
    RegisterWorkflowDefinitionsInput,
    RemoveWorkflowDefinitionInput,
    RunWorkflowInput,
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowRuntimeFacade,
    WorkflowStepDefinition,
    WorkflowStepObservation,
} from '../types'
import type {WorkflowRunId} from '../types/ids'

interface RunRecord {
    input: RunWorkflowInput
    subject: Subject<WorkflowObservation>
    handlerContext?: KernelRuntimeHandlerContext
    resolveTerminal?: (observation: WorkflowObservation) => void
    rejectTerminal?: (error: unknown) => void
    settled?: boolean
    started?: boolean
}

const terminalStatuses = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'])

const createWorkflowRunId = (): WorkflowRunId =>
    createEnvelopeId() as unknown as WorkflowRunId

const sleep = (delayMs: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, delayMs)
    })

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
                    reject(createAppError(workflowRuntimeErrorDefinitions.workflowStepFailed, {
                        args: {stepKey: input.stepKey},
                        details: {
                            reason: `${input.type}-timeout`,
                            timeoutMs: input.timeoutMs,
                        },
                    }))
                }, input.timeoutMs)
            }),
        ])
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }
}

const isTerminalObservation = (observation: WorkflowObservation): boolean =>
    terminalStatuses.has(observation.status)

const getWorkflowState = (
    context: RuntimeModuleContext,
): Record<string, unknown> => context.getState() as unknown as Record<string, unknown>

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

const getProgressTotal = (step: WorkflowStepDefinition): number => {
    if (step.type !== 'flow' || !step.steps?.length) {
        return 1
    }

    return step.steps.reduce((sum, child) => sum + getProgressTotal(child), 0)
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
        const completedChildren = [...(definition.rootStep.steps ?? [])]
            .find(child => observation.steps[child.stepKey]?.status === 'COMPLETED')
        if (completedChildren) {
            return observation.context.stepOutputs[completedChildren.stepKey]
        }
    }

    return observation.output
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

const createFailedObservation = (input: {
    requestId: RequestId
    workflowRunId: WorkflowRunId
    workflowKey: string
    error: ReturnType<typeof createAppError>
    contextInput?: unknown
}): WorkflowObservation => {
    const base = createInitialObservation({
        requestId: input.requestId,
        workflowRunId: input.workflowRunId,
        workflowKey: input.workflowKey,
        status: 'RUNNING',
        contextInput: input.contextInput,
    })
    const failedAt = nowTimestampMs()
    const error = toWorkflowErrorView({appError: input.error})
    return patchObservation(
        base,
        {
            status: 'FAILED',
            error,
            completedAt: failedAt,
            updatedAt: failedAt,
        },
        createWorkflowEvent({
            requestId: input.requestId,
            workflowRunId: input.workflowRunId,
            type: 'workflow.failed',
            error,
            occurredAt: failedAt,
        }),
    )
}

const createTerminalPromise = (
    run: RunRecord,
): Promise<WorkflowObservation> => {
    return new Promise<WorkflowObservation>((resolve, reject) => {
        run.resolveTerminal = resolve
        run.rejectTerminal = reject
    })
}

export const createWorkflowEngine = (
    context: RuntimeModuleContext,
): WorkflowRuntimeFacade & {
    runFromCommand(
        input: Omit<RunWorkflowInput, 'requestId'> & {requestId: RequestId},
        handlerContext: KernelRuntimeHandlerContext,
    ): Promise<WorkflowObservation>
} => {
    let activeRun: RunRecord | undefined
    const queue: RunRecord[] = []
    const runsByRequestId = new Map<RequestId, RunRecord>()

    const dispatchObservation = (observation: WorkflowObservation) => {
        context.dispatchAction(
            workflowObservationsStateActions.putObservation(cloneObservation(observation)),
        )
        runsByRequestId.get(observation.requestId)?.subject.next(cloneObservation(observation))
    }

    const updateQueueState = () => {
        const updatedAt = nowTimestampMs()
        context.dispatchAction(
            workflowQueueStateActions.setActiveRequest({
                requestId: activeRun?.input.requestId,
                updatedAt,
            }),
        )
        context.dispatchAction(
            workflowQueueStateActions.replaceQueuedRequests({
                requestIds: queue.map(item => item.input.requestId),
                updatedAt,
            }),
        )

        queue.forEach((run, index) => {
            const current = selectWorkflowObservationByRequestId(
                getWorkflowState(context),
                run.input.requestId,
            )
            if (!current || isTerminalObservation(current)) {
                return
            }

            dispatchObservation({
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
        dispatchObservation(observation)
        run.subject.complete()
        run.resolveTerminal?.(cloneObservation(observation))
        runsByRequestId.delete(observation.requestId)

        if (activeRun?.input.requestId === observation.requestId) {
            activeRun = undefined
        } else {
            const queuedIndex = queue.findIndex(item => item.input.requestId === observation.requestId)
            if (queuedIndex >= 0) {
                queue.splice(queuedIndex, 1)
            }
        }

        updateQueueState()
        void startNext()
    }

    const failBeforeStart = (
        run: RunRecord,
        error: ReturnType<typeof createAppError>,
    ) => {
        settleRun(
            run,
            createFailedObservation({
                requestId: run.input.requestId,
                workflowRunId: run.input.workflowRunId ?? createWorkflowRunId(),
                workflowKey: run.input.workflowKey,
                error,
                contextInput: run.input.input,
            }),
        )
    }

    const toAppError = (
        error: unknown,
        stepKey: string,
    ): ReturnType<typeof createAppError> => {
        if (typeof error === 'object' && error !== null && 'key' in error && 'message' in error) {
            return error as ReturnType<typeof createAppError>
        }

        return createAppError(workflowRuntimeErrorDefinitions.workflowStepFailed, {
            args: {stepKey},
            details: error,
            cause: error,
        })
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

        const resolved = context.resolveParameter<number>({
            key: workflowRuntimeParameterDefinitions.defaultWorkflowTimeoutMs.key,
            definition: workflowRuntimeParameterDefinitions.defaultWorkflowTimeoutMs,
        })

        if (typeof resolved.value === 'number' && resolved.value > 0) {
            return resolved.value
        }

        return undefined
    }

    const resolveStepTimeoutMs = (
        step: WorkflowStepDefinition,
    ): number | undefined => {
        if (typeof step.timeoutMs === 'number' && step.timeoutMs > 0) {
            return step.timeoutMs
        }

        const resolved = context.resolveParameter<number>({
            key: workflowRuntimeParameterDefinitions.defaultStepTimeoutMs.key,
            definition: workflowRuntimeParameterDefinitions.defaultStepTimeoutMs,
        })

        if (typeof resolved.value === 'number' && resolved.value > 0) {
            return resolved.value
        }

        return undefined
    }

    const createTimedOutObservation = (input: {
        observation: WorkflowObservation
        stepKey?: string
        stepRunId?: WorkflowStepObservation['stepRunId']
        appError: ReturnType<typeof createAppError>
    }): WorkflowObservation => {
        const timedOutAt = nowTimestampMs()
        const errorView = toWorkflowErrorView({appError: input.appError})
        let nextObservation = patchObservation(
            input.observation,
            {
                status: 'TIMED_OUT',
                error: errorView,
                timedOutAt,
                completedAt: timedOutAt,
                updatedAt: timedOutAt,
            },
            input.stepKey
                ? createWorkflowEvent({
                    requestId: input.observation.requestId,
                    workflowRunId: input.observation.workflowRunId,
                    stepRunId: input.stepRunId,
                    stepKey: input.stepKey,
                    type: 'step.timed-out',
                    error: errorView,
                    occurredAt: timedOutAt,
                })
                : undefined,
        )

        if (input.stepKey) {
            nextObservation = patchObservation(nextObservation, {
                steps: {
                    ...nextObservation.steps,
                    [input.stepKey]: {
                        ...nextObservation.steps[input.stepKey],
                        status: 'TIMED_OUT',
                        error: errorView,
                        completedAt: timedOutAt,
                        updatedAt: timedOutAt,
                    },
                },
                updatedAt: timedOutAt,
            })
        }

        return patchObservation(
            nextObservation,
            {},
            createWorkflowEvent({
                requestId: input.observation.requestId,
                workflowRunId: input.observation.workflowRunId,
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
            return selectWorkflowObservationByRequestId(
                getWorkflowState(context),
                run.input.requestId,
            ) ?? observation
        }

        const stepRunId = createCommandId() as unknown as WorkflowStepObservation['stepRunId']
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
                    [step.stepKey]: createStepObservation({
                        stepRunId,
                        stepKey: step.stepKey,
                        type: step.type,
                        status: 'RUNNING',
                    }),
                },
                updatedAt: startedAt,
            },
            createWorkflowEvent({
                requestId: run.input.requestId,
                workflowRunId: observation.workflowRunId,
                stepRunId,
                stepKey: step.stepKey,
                type: 'step.started',
                occurredAt: startedAt,
            }),
        )
        dispatchObservation(nextObservation)

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
                        stepRunId,
                        stepKey: step.stepKey,
                        type: 'step.skipped',
                        occurredAt: skippedAt,
                    }),
                )
                dispatchObservation(nextObservation)
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
                        if (!run.handlerContext) {
                            throw createStepFailedError(step.stepKey, {reason: 'missing handler context'})
                        }

                        const result = await withTimeout({
                            promise: run.handlerContext.dispatchChild({
                                commandName,
                                payload: commandInput?.payload ?? {},
                            }),
                            timeoutMs: resolvedStepTimeoutMs,
                            stepKey: step.stepKey,
                            type: 'step',
                        })

                        if (result.status === 'failed') {
                            throw result.error
                        }

                        rawOutput = result.result ?? {}
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
                                    await sleep(stepInput.delayMs)
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
                                stepRunId,
                                stepKey: step.stepKey,
                                type: 'step.retrying',
                                payload: {
                                    attempt,
                                    maxRetries,
                                },
                                occurredAt: retryAt,
                            }),
                        )
                        dispatchObservation(nextObservation)
                        if (step.strategy?.retry?.intervalMs) {
                            await sleep(step.strategy.retry.intervalMs)
                        }
                        continue
                    }
                    throw error
                }
            }

            if (run.settled) {
                return selectWorkflowObservationByRequestId(
                    getWorkflowState(context),
                    run.input.requestId,
                ) ?? nextObservation
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
                    stepRunId,
                    stepKey: step.stepKey,
                    type: 'step.completed',
                    payload: outputResolution.output,
                    occurredAt: completedAt,
                }),
            )
            dispatchObservation(nextObservation)
            return nextObservation
        } catch (error) {
            if (run.settled) {
                return selectWorkflowObservationByRequestId(
                    getWorkflowState(context),
                    run.input.requestId,
                ) ?? nextObservation
            }

            const appError = toAppError(error, step.stepKey)
            const errorView = toWorkflowErrorView({appError})
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
                        stepRunId,
                        stepKey: step.stepKey,
                        type: 'step.skipped',
                        error: errorView,
                        occurredAt: failedAt,
                    }),
                )
                dispatchObservation(nextObservation)
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
                            stepRunId,
                            stepKey: step.stepKey,
                            type: 'step.compensating',
                            payload: {
                                compensationStepKey: compensationStep.stepKey,
                            },
                            error: errorView,
                            occurredAt: compensatingAt,
                        }),
                    )
                    dispatchObservation(nextObservation)
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
                            stepRunId,
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
                    stepRunId,
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

        return executeLeafStep(run, definition, observation, step, progress)
    }

    const runActive = async (run: RunRecord) => {
        const definitionsBySource = selectWorkflowDefinitionsBySource(getWorkflowState(context))
        const definition = resolveWorkflowDefinitionFromSources(
            definitionsBySource,
            run.input.workflowKey,
        )

        if (!definition) {
            failBeforeStart(
                run,
                hasOnlyDisabledDefinitionsBySource(definitionsBySource, run.input.workflowKey)
                    ? createDefinitionDisabledError(run.input.workflowKey)
                    : createDefinitionNotFoundError(run.input.workflowKey),
            )
            return
        }

        let observation = selectWorkflowObservationByRequestId(
            getWorkflowState(context),
            run.input.requestId,
        ) ?? createInitialObservation({
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
        dispatchObservation(observation)

        const progress = {
            current: 0,
            total: getProgressTotal(definition.rootStep),
        }
        const workflowTimeoutMs = resolveWorkflowTimeoutMs(definition, run)

        try {
            const executed = await withTimeout({
                promise: executeStep(
                    run,
                    definition,
                    observation,
                    definition.rootStep,
                    progress,
                ),
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
                settleRun(
                    run,
                    createTimedOutObservation({
                        observation,
                        stepKey: definition.rootStep.stepKey,
                        appError,
                    }),
                )
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

        if (activeRun || queue.length > 0) {
            queue.push(run)
            const observation = createInitialObservation({
                requestId: run.input.requestId,
                workflowRunId: run.input.workflowRunId ?? createWorkflowRunId(),
                workflowKey: run.input.workflowKey,
                status: 'WAITING_IN_QUEUE',
                queuePosition: queue.length,
                contextInput: run.input.input,
            })
            dispatchObservation(observation)
            updateQueueState()
            return
        }

        activeRun = run
        updateQueueState()
        void runActive(run)
    }

    const createRunRecord = (
        input: RunWorkflowInput,
        handlerContext?: KernelRuntimeHandlerContext,
    ): RunRecord => {
        if (runsByRequestId.has(input.requestId)) {
            throw createDuplicateRequestError(input.requestId)
        }

        const workflowRunId = input.workflowRunId ?? createWorkflowRunId()
        const run: RunRecord = {
            input: {
                ...input,
                workflowRunId,
            },
            subject: new Subject<WorkflowObservation>(),
            handlerContext,
        }
        runsByRequestId.set(input.requestId, run)
        return run
    }

    return {
        run$(input) {
            const run = createRunRecord(input)
            return new Observable<WorkflowObservation>(subscriber => {
                const subscription = run.subject.subscribe(subscriber)
                enqueue(run)
                const current = selectWorkflowObservationByRequestId(
                    getWorkflowState(context),
                    run.input.requestId,
                )
                if (current) {
                    subscriber.next(cloneObservation(current))
                    if (isTerminalObservation(current)) {
                        subscriber.complete()
                    }
                }
                return () => subscription.unsubscribe()
            })
        },
        runFromCommand(input, handlerContext) {
            const run = createRunRecord(input, handlerContext)
            const terminalPromise = createTerminalPromise(run)
            enqueue(run)
            return terminalPromise
        },
        cancel(input) {
            const requestId = input.requestId
                ?? [...runsByRequestId.keys()].find(id => {
                    const observation = selectWorkflowObservationByRequestId(
                        getWorkflowState(context),
                        id,
                    )
                    return observation?.workflowRunId === input.workflowRunId
                })

            if (!requestId) {
                throw createRunNotFoundError()
            }

            const queuedIndex = queue.findIndex(item => item.input.requestId === requestId)
            const run = queuedIndex >= 0
                ? queue[queuedIndex]
                : activeRun?.input.requestId === requestId
                    ? activeRun
                    : undefined
            const current = selectWorkflowObservationByRequestId(getWorkflowState(context), requestId)

            if (!run || !current) {
                throw createRunNotFoundError()
            }

            const cancelledAt = nowTimestampMs()
            settleRun(
                run,
                patchObservation(
                    current,
                    {
                        status: 'CANCELLED',
                        cancelledAt,
                        updatedAt: cancelledAt,
                    },
                    createWorkflowEvent({
                        requestId: current.requestId,
                        workflowRunId: current.workflowRunId,
                        type: 'workflow.cancelled',
                        payload: {reason: input.reason},
                        occurredAt: cancelledAt,
                    }),
                ),
            )
        },
        getObservation(requestId) {
            return selectWorkflowObservationByRequestId(getWorkflowState(context), requestId)
        },
        registerDefinitions(input) {
            context.dispatchAction(
                workflowDefinitionsStateActions.upsertDefinitions({
                    definitions: input.definitions,
                    source: input.source,
                    updatedAt: input.updatedAt ?? nowTimestampMs(),
                }),
            )
        },
        removeDefinition(input) {
            context.dispatchAction(
                workflowDefinitionsStateActions.removeDefinition({
                    workflowKey: input.workflowKey,
                    definitionId: input.definitionId,
                    source: 'host',
                    updatedAt: nowTimestampMs(),
                }),
            )
        },
    }
}
