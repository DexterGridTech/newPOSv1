import {
    createAppError,
    isAppError,
    nowTimestampMs,
    type AppError,
} from '@next/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import type {
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowStepDefinition,
} from '../types'
import {selectWorkflowObservationByRequestId} from '../selectors'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'
import {
    createInitialObservation,
    createWorkflowEvent,
    createWorkflowStepRunId,
    patchObservation,
    toWorkflowErrorView,
} from './defaults'
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
    isTimeoutError,
    withTimeout,
} from './engineObservation'
import type {WorkflowEngineConfig} from './engineConfig'
import type {WorkflowRunRecord} from './engineRunState'

const delay = (timeoutMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, timeoutMs))

export interface WorkflowExecutionResult {
    status: 'terminal' | 'failed-before-start' | 'settled'
    observation?: WorkflowObservation
    error?: AppError
}

export const createWorkflowEngineExecutor = (input: {
    context: RuntimeModuleContextV2
    config: WorkflowEngineConfig
    notify(observation: WorkflowObservation): void
}): {
    runActive(run: WorkflowRunRecord, definition: WorkflowDefinition): Promise<WorkflowExecutionResult>
} => {
    const toAppError = (
        error: unknown,
        stepKey: string,
    ): AppError => {
        if (isAppError(error)) {
            return error
        }
        return createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey},
            details: error,
            cause: error,
        })
    }

    const createTimedOutObservation = (timeout: {
        observation: WorkflowObservation
        stepKey?: string
        appError: AppError
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
            return selectWorkflowObservationByRequestId(input.context.getState(), run.input.requestId) ?? observation
        }

        const stepRunId = createWorkflowStepRunId()
        let nextObservation = markStepStarted({
            observation,
            step,
            stepRunId,
            progressTotal: progress.total,
        })
        input.notify(nextObservation)

        try {
            const conditionPassed = await evaluateWorkflowCondition({
                platformPorts: input.context.platformPorts,
                expression: step.condition,
                context: nextObservation.context,
            })

            if (!conditionPassed) {
                nextObservation = markStepSkipped({
                    observation: nextObservation,
                    step,
                    progress,
                })
                input.notify(nextObservation)
                return nextObservation
            }

            let rawOutput: unknown = {}
            const stepInput = await resolveWorkflowInput({
                platformPorts: input.context.platformPorts,
                mapping: step.input,
                context: nextObservation.context,
            }) as ResolvedWorkflowStepInput | undefined

            let attempt = 0
            const maxRetries = step.strategy?.onError === 'retry'
                ? (step.strategy.retry?.times ?? 0)
                : 0
            const resolvedStepTimeoutMs = input.config.resolveStepTimeoutMs(step)

            while (true) {
                try {
                    rawOutput = await executeWorkflowStepRawOutput({
                        run,
                        step,
                        stepInput,
                        resolvedStepTimeoutMs,
                        platformPorts: input.context.platformPorts,
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
                        input.notify(nextObservation)
                        if (step.strategy?.retry?.intervalMs) {
                            await delay(step.strategy.retry.intervalMs)
                        }
                        continue
                    }
                    throw error
                }
            }

            if (run.settled) {
                return selectWorkflowObservationByRequestId(input.context.getState(), run.input.requestId) ?? nextObservation
            }

            const outputResolution = await applyWorkflowOutput({
                platformPorts: input.context.platformPorts,
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
            input.notify(nextObservation)
            return nextObservation
        } catch (error) {
            if (run.settled) {
                return selectWorkflowObservationByRequestId(input.context.getState(), run.input.requestId) ?? nextObservation
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
                input.notify(nextObservation)
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
                    input.notify(nextObservation)

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

    const runActive = async (
        run: WorkflowRunRecord,
        definition: WorkflowDefinition,
    ): Promise<WorkflowExecutionResult> => {
        let observation = selectWorkflowObservationByRequestId(input.context.getState(), run.input.requestId)
            ?? createInitialObservation({
                requestId: run.input.requestId,
                workflowRunId: run.input.workflowRunId!,
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
        input.notify(observation)

        const progress = {
            current: 0,
            total: getProgressTotal(definition.rootStep),
        }
        const workflowTimeoutMs = input.config.resolveWorkflowTimeoutMs(
            definition,
            run.input.options?.timeoutMs,
        )

        try {
            const executed = await withTimeout({
                promise: executeStep(run, definition, observation, definition.rootStep, progress),
                timeoutMs: workflowTimeoutMs,
                stepKey: definition.rootStep.stepKey,
                type: 'workflow',
            })

            if (run.settled) {
                return {status: 'settled'}
            }

            if (executed.status === 'FAILED' || executed.status === 'TIMED_OUT') {
                return {
                    status: 'terminal',
                    observation: executed,
                }
            }

            const completedAt = nowTimestampMs()
            return {
                status: 'terminal',
                observation: patchObservation(
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
            }
        } catch (error) {
            if (run.settled) {
                return {status: 'settled'}
            }
            const appError = toAppError(error, definition.rootStep.stepKey)
            if (isTimeoutError(appError)) {
                return {
                    status: 'terminal',
                    observation: createTimedOutObservation({
                        observation,
                        stepKey: definition.rootStep.stepKey,
                        appError,
                    }),
                }
            }
            return {
                status: 'failed-before-start',
                error: appError,
            }
        }
    }

    return {
        runActive,
    }
}
