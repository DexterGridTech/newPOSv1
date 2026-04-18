import React from 'react'
import {describe, expect, it} from 'vitest'
import {UiRuntimeRootShell} from '../../src'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'

describe('UiRuntimeRootShell', () => {
    it('renders the root shell without introducing router semantics', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(<UiRuntimeRootShell />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
    })
})
