import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import type {UiScreenPartDefinition} from '../types'

export const createUiNavigationBridge = (runtime: KernelRuntimeV2) => ({
    navigateTo<TProps = unknown>(input: {
        target: UiScreenPartDefinition<TProps>
        props?: TProps
        id?: string | null
        source?: string
    }) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.showScreen, {
                definition: input.target.definition,
                props: input.props,
                id: input.id,
                source: input.source,
            }),
        )
    },
    replaceScreen<TProps = unknown>(input: {
        target: UiScreenPartDefinition<TProps>
        props?: TProps
        id?: string | null
        source?: string
    }) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.replaceScreen, {
                definition: input.target.definition,
                props: input.props,
                id: input.id,
                source: input.source,
            }),
        )
    },
    openModal<TProps = unknown>(input: {
        target: UiScreenPartDefinition<TProps>
        overlayId: string
        props?: TProps
    }) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.openOverlay, {
                definition: input.target.definition,
                id: input.overlayId,
                props: input.props,
            }),
        )
    },
    closeModal(overlayId: string) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                overlayId,
            }),
        )
    },
    clearOverlays() {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.clearOverlays, {}),
        )
    },
    setUiVariables(payload: Record<string, unknown>) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.setUiVariables, payload),
        )
    },
    clearUiVariables(keys: readonly string[]) {
        return runtime.dispatchCommand(
            createCommand(uiRuntimeV2CommandDefinitions.clearUiVariables, keys),
        )
    },
})
