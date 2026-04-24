import {createAppError} from '@next/kernel-base-contracts'
import {createWorkspaceActionDispatcher} from '@next/kernel-base-state-runtime'
import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type ActorExecutionContext,
} from '@next/kernel-base-runtime-shell-v2'
import {selectTopologyDisplayMode, selectTopologyWorkspace} from '@next/kernel-base-topology-runtime-v3'
import {createUiOverlayEntry} from '../../foundations'
import {moduleName} from '../../moduleName'
import {normalizeUiRuntimeWorkspace} from '../../selectors'
import {uiRuntimeV2ErrorDefinitions} from '../../supports'
import {uiRuntimeV2CommandDefinitions} from '../commands'
import {uiRuntimeV2OverlayStateActions} from '../slices'

const getWorkspaceDispatcher = (context: ActorExecutionContext) => {
    const workspace = normalizeUiRuntimeWorkspace(selectTopologyWorkspace(context.getState()))
    return createWorkspaceActionDispatcher({
        dispatch: context.dispatchAction,
        routeContext: {
            workspace,
        },
    })
}

const getDisplayMode = (context: ActorExecutionContext) =>
    selectTopologyDisplayMode(context.getState()) ?? 'PRIMARY'

const defineActor = createModuleActorFactory(moduleName)

export const createUiRuntimeOverlayRuntimeActorDefinition = (): ActorDefinition => defineActor(
    'UiRuntimeOverlayRuntimeActor',
    [
        onCommand(uiRuntimeV2CommandDefinitions.openOverlay, context => {
            if (!context.command.payload.id) {
                throw createAppError(uiRuntimeV2ErrorDefinitions.overlayIdRequired)
            }
            getWorkspaceDispatcher(context)(
                uiRuntimeV2OverlayStateActions.openOverlay({
                    displayMode: getDisplayMode(context),
                    overlay: createUiOverlayEntry({
                        definition: context.command.payload.definition,
                        id: context.command.payload.id,
                        props: context.command.payload.props,
                    }),
                }),
            )
            return {overlayId: context.command.payload.id}
        }),
        onCommand(uiRuntimeV2CommandDefinitions.closeOverlay, context => {
            getWorkspaceDispatcher(context)(
                uiRuntimeV2OverlayStateActions.closeOverlay({
                    displayMode: getDisplayMode(context),
                    overlayId: context.command.payload.overlayId,
                }),
            )
            return {overlayId: context.command.payload.overlayId}
        }),
        onCommand(uiRuntimeV2CommandDefinitions.clearOverlays, context => {
            getWorkspaceDispatcher(context)(
                uiRuntimeV2OverlayStateActions.clearOverlays({
                    displayMode: getDisplayMode(context),
                }),
            )
            return {displayMode: getDisplayMode(context)}
        }),
    ],
)
