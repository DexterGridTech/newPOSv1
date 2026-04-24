import type {ActorExecutionContext} from '@next/kernel-base-runtime-shell-v2'
import type {
    WorkflowDefinition,
    WorkflowObservation,
    WorkflowStepDefinition,
} from '../types'

export const getProgressTotal = (step: WorkflowStepDefinition): number => {
    if (step.type !== 'flow' || !step.steps?.length) {
        return 1
    }
    return step.steps.reduce((sum, child) => sum + getProgressTotal(child), 0)
}

export const findWorkflowStep = (
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

export const resolveWorkflowOutput = (
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

export const aggregateCommandStepOutput = (
    result: Awaited<ReturnType<ActorExecutionContext['dispatchCommand']>>,
) => {
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
