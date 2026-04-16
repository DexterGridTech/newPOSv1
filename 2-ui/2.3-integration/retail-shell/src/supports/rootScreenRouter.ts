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
    const target = input.activated
        ? retailShellNavigationTargets.welcome
        : retailShellNavigationTargets.activation

    await context.dispatchCommand(createCommand(
        uiRuntimeV2CommandDefinitions.replaceScreen,
        {
            definition: target.definition,
            props: input.activated ? {terminalId: input.terminalId} : undefined,
            source: input.source,
        },
    ))
}
