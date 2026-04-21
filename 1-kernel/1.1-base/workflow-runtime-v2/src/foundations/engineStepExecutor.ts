import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    RunWorkflowInput,
    WorkflowStepDefinition,
} from '../types'
import {createStepFailedError} from './defaults'
import {executeExternalCall, executeExternalOn, executeExternalSubscribe} from './connectorRuntime'
import {aggregateCommandStepOutput} from './engineStep'
import {ensureCommandStepRunnable} from './engineTransitions'
import {withTimeout} from './engineObservation'
import type {WorkflowRunRecord} from './engineRunState'

const delay = (timeoutMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, timeoutMs))

export interface ResolvedWorkflowStepInput {
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
}

export const executeWorkflowStepRawOutput = async (input: {
    run: WorkflowRunRecord
    step: WorkflowStepDefinition
    stepInput: ResolvedWorkflowStepInput | undefined
    resolvedStepTimeoutMs?: number
    platformPorts: Parameters<typeof executeExternalCall>[0]['platformPorts']
}): Promise<unknown> => {
    if (input.step.type === 'command') {
        const commandInput = input.stepInput
        const commandName = commandInput?.commandName
        const actorContext = input.run.actorContext
        ensureCommandStepRunnable({
            step: input.step,
            commandName,
            hasActorContext: Boolean(actorContext),
        })
        if (!commandName || !actorContext) {
            throw createStepFailedError(input.step.stepKey, {reason: 'command step not runnable'})
        }

        const result = await withTimeout({
            promise: actorContext.dispatchCommand(createCommand({
                moduleName: commandName.split('.').slice(0, -1).join('.') || 'external',
                commandName,
                visibility: 'public',
                timeoutMs: 60_000,
                allowNoActor: false,
                allowReentry: false,
                defaultTarget: 'local',
            }, commandInput?.payload ?? {})),
            timeoutMs: input.resolvedStepTimeoutMs,
            stepKey: input.step.stepKey,
            type: 'step',
        })

        if (result.status === 'FAILED' || result.status === 'PARTIAL_FAILED' || result.status === 'TIMEOUT') {
            throw createStepFailedError(input.step.stepKey, result)
        }
        return aggregateCommandStepOutput(result)
    }

    if (input.step.type === 'external-call') {
        return await withTimeout({
            promise: executeExternalCall({
                platformPorts: input.platformPorts,
                stepKey: input.step.stepKey,
                payload: input.stepInput,
            }),
            timeoutMs: input.resolvedStepTimeoutMs,
            stepKey: input.step.stepKey,
            type: 'step',
        })
    }

    if (input.step.type === 'external-subscribe') {
        return await withTimeout({
            promise: executeExternalSubscribe({
                platformPorts: input.platformPorts,
                stepKey: input.step.stepKey,
                payload: input.stepInput,
            }),
            timeoutMs: input.resolvedStepTimeoutMs,
            stepKey: input.step.stepKey,
            type: 'step',
        })
    }

    if (input.step.type === 'external-on') {
        return await withTimeout({
            promise: executeExternalOn({
                platformPorts: input.platformPorts,
                stepKey: input.step.stepKey,
                payload: input.stepInput,
            }),
            timeoutMs: input.resolvedStepTimeoutMs,
            stepKey: input.step.stepKey,
            type: 'step',
        })
    }

    return await withTimeout({
        promise: (async () => {
            if (typeof input.stepInput?.delayMs === 'number' && input.stepInput.delayMs > 0) {
                await delay(input.stepInput.delayMs)
            }
            return input.stepInput?.output ?? input.stepInput ?? {}
        })(),
        timeoutMs: input.resolvedStepTimeoutMs,
        stepKey: input.step.stepKey,
        type: 'step',
    })
}
