import {
    createCommand,
    type ActorExecutionContext,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {cateringShellNavigationTargets} from '../foundations'

export interface ReplaceCateringShellRootScreenInput {
    activated: boolean
    terminalId?: string
    source: string
}

export const replaceCateringShellRootScreen = async (
    context: Pick<ActorExecutionContext, 'dispatchCommand'>,
    input: ReplaceCateringShellRootScreenInput,
) => {
    const primaryTarget = input.activated
        ? cateringShellNavigationTargets.masterDataWorkbenchPrimary
        : cateringShellNavigationTargets.activation
    const secondaryTarget = input.activated
        ? cateringShellNavigationTargets.masterDataWorkbenchSecondary
        : cateringShellNavigationTargets.activationSecondary

    await context.dispatchCommand(createCommand(
        uiRuntimeV2CommandDefinitions.replaceScreen,
        {
            definition: primaryTarget.definition,
            props: input.activated ? {terminalId: input.terminalId} : undefined,
            source: input.source,
        },
    ))
    await context.dispatchCommand(createCommand(
        uiRuntimeV2CommandDefinitions.replaceScreen,
        {
            definition: secondaryTarget.definition,
            props: input.activated ? {terminalId: input.terminalId} : undefined,
            source: input.source,
        },
    ))
}
