import React from 'react'
import {describe, expect, it} from 'vitest'
import {
    ScreenContainer,
    clearUiRendererRegistry,
    uiRuntimeRootVariables,
} from '../../src'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'
import {runtimeReactScenarioParts} from '../support/runtimeReactScenarioParts'

describe('ScreenContainer', () => {
    it('renders an empty screen fallback when no child screen is resolved', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-empty-screen')).resolves.toBeTruthy()
    })

    it('renders a diagnostic fallback when screen entry exists but renderer is missing', async () => {
        const harness = await createRuntimeReactHarness()

        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [runtimeReactScenarioParts.detail.definition],
            },
        ))
        clearUiRendererRegistry()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: runtimeReactScenarioParts.detail.definition,
                props: {label: 'missing-renderer'},
                source: 'runtime-react-screen-container.spec',
            },
        ))

        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-runtime-react:missing-renderer')).resolves.toBeTruthy()
        await expect(tree.queryNodesByTextContains(runtimeReactScenarioParts.detail.definition.rendererKey)).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains(runtimeReactScenarioParts.detail.definition.partKey)).resolves.not.toHaveLength(0)
    })
})
