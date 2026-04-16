import React from 'react'
import {describe, expect, it} from 'vitest'
import {ScreenContainer, uiRuntimeRootVariables} from '../../src'
import {createRuntimeReactHarness, renderWithStore} from '../support/runtimeReactHarness'

describe('ScreenContainer', () => {
    it('renders an empty screen fallback when no child screen is resolved', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithStore(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        expect(tree.toJSON()).toBeTruthy()
    })
})
