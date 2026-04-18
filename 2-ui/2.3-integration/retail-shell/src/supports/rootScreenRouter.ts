import {
    createCommand,
    type ActorExecutionContext,
} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {retailShellNavigationTargets} from '../foundations'

export interface ReplaceRetailShellRootScreenInput {
    activated: boolean
    terminalId?: string
    source: string
}

export const replaceRetailShellRootScreen = async (
    context: Pick<ActorExecutionContext, 'dispatchCommand'>,
    input: ReplaceRetailShellRootScreenInput,
) => {
    const primaryTarget = input.activated
        ? retailShellNavigationTargets.welcome
        : retailShellNavigationTargets.activation
    const secondaryTarget = input.activated
        ? retailShellNavigationTargets.welcomeSecondary
        : retailShellNavigationTargets.activationSecondary

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
