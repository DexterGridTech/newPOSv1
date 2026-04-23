import {createWorkspaceActionDispatcher} from '@impos2/kernel-base-state-runtime'
import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type ActorExecutionContext,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyWorkspace} from '@impos2/kernel-base-topology-runtime-v3'
import {moduleName} from '../../moduleName'
import {normalizeUiRuntimeWorkspace} from '../../selectors'
import {uiRuntimeV2CommandDefinitions} from '../commands'
import {uiRuntimeV2VariableStateActions} from '../slices'

const getWorkspaceDispatcher = (context: ActorExecutionContext) => {
    const workspace = normalizeUiRuntimeWorkspace(selectTopologyWorkspace(context.getState()))
    return createWorkspaceActionDispatcher({
        dispatch: context.dispatchAction,
        routeContext: {
            workspace,
        },
    })
}

const defineActor = createModuleActorFactory(moduleName)

export const createUiRuntimeVariableRuntimeActorDefinition = (): ActorDefinition => defineActor(
    'UiRuntimeVariableRuntimeActor',
    [
        onCommand(uiRuntimeV2CommandDefinitions.setUiVariables, context => {
            getWorkspaceDispatcher(context)(
                uiRuntimeV2VariableStateActions.setUiVariables(context.command.payload),
            )
            return {keys: Object.keys(context.command.payload)}
        }),
        onCommand(uiRuntimeV2CommandDefinitions.clearUiVariables, context => {
            getWorkspaceDispatcher(context)(
                uiRuntimeV2VariableStateActions.clearUiVariables(context.command.payload),
            )
            return {keys: [...context.command.payload]}
        }),
    ],
)
