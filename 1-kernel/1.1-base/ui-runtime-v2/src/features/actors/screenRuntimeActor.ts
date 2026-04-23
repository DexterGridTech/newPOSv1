import {createAppError} from '@impos2/kernel-base-contracts'
import {createWorkspaceActionDispatcher} from '@impos2/kernel-base-state-runtime'
import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type ActorExecutionContext,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyWorkspace} from '@impos2/kernel-base-topology-runtime-v3'
import {createUiScreenRuntimeEntry} from '../../foundations'
import {moduleName} from '../../moduleName'
import {normalizeUiRuntimeWorkspace} from '../../selectors'
import {uiRuntimeV2ErrorDefinitions} from '../../supports'
import {uiRuntimeV2CommandDefinitions} from '../commands'
import {uiRuntimeV2ScreenStateActions} from '../slices'

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

export const createUiRuntimeScreenRuntimeActorDefinition = (): ActorDefinition => defineActor(
    'UiRuntimeScreenRuntimeActor',
    [
        onCommand(uiRuntimeV2CommandDefinitions.showScreen, context => {
            const definition = context.command.payload.definition
            if (!definition.containerKey) {
                throw createAppError(uiRuntimeV2ErrorDefinitions.invalidScreenTarget, {
                    details: {partKey: definition.partKey},
                })
            }
            getWorkspaceDispatcher(context)(
                uiRuntimeV2ScreenStateActions.setScreen({
                    containerKey: definition.containerKey,
                    entry: createUiScreenRuntimeEntry({
                        definition,
                        id: context.command.payload.id,
                        props: context.command.payload.props,
                        source: context.command.payload.source,
                        operation: 'show',
                    }),
                }),
            )
            return {containerKey: definition.containerKey}
        }),
        onCommand(uiRuntimeV2CommandDefinitions.replaceScreen, context => {
            const definition = context.command.payload.definition
            if (!definition.containerKey) {
                throw createAppError(uiRuntimeV2ErrorDefinitions.invalidScreenTarget, {
                    details: {partKey: definition.partKey},
                })
            }
            getWorkspaceDispatcher(context)(
                uiRuntimeV2ScreenStateActions.setScreen({
                    containerKey: definition.containerKey,
                    entry: createUiScreenRuntimeEntry({
                        definition,
                        id: context.command.payload.id,
                        props: context.command.payload.props,
                        source: context.command.payload.source,
                        operation: 'replace',
                    }),
                }),
            )
            return {containerKey: definition.containerKey}
        }),
        onCommand(uiRuntimeV2CommandDefinitions.resetScreen, context => {
            getWorkspaceDispatcher(context)(
                uiRuntimeV2ScreenStateActions.resetScreen({
                    containerKey: context.command.payload.containerKey,
                }),
            )
            return {containerKey: context.command.payload.containerKey}
        }),
    ],
)
