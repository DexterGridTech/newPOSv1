import React from 'react'
import {describe, expect, it} from 'vitest'
import {act} from 'react-test-renderer'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {
    uiRuntimeRootVariables,
    useScreenPartsByContainer,
} from '../../src'
import {
    createRuntimeReactHarness,
    renderWithStore,
} from '../support/runtimeReactHarness'
import {createRuntimeReactScenarioModule} from '../support/runtimeReactScenarioModule'

describe('useScreenPartsByContainer', () => {
    it('does not rerender subscribers when unrelated store updates keep the same screen-part list', async () => {
        const harness = await createRuntimeReactHarness({
            modules: [createRuntimeReactScenarioModule()],
            displayContext: {
                displayIndex: 0,
                displayCount: 2,
            },
        })
        const renderEvents: Array<readonly string[]> = []

        const Probe: React.FC = () => {
            const definitions = useScreenPartsByContainer(uiRuntimeRootVariables.primaryRootContainer)
            renderEvents.push(definitions.map(item => item.partKey))
            return null
        }

        await act(async () => {
            renderWithStore(<Probe />, harness.store, harness.runtime)
        })

        expect(renderEvents).toEqual([[
            'ui.base.empty-screen',
            'ui.base.runtime-react.test.home',
            'ui.base.runtime-react.test.detail',
        ]])

        await act(async () => {
            await harness.runtime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    'ui.base.runtime-react.test.message': 'updated-without-screen-change',
                },
            ))
        })

        expect(renderEvents).toEqual([[
            'ui.base.empty-screen',
            'ui.base.runtime-react.test.home',
            'ui.base.runtime-react.test.detail',
        ]])
    })
})
