import React from 'react'
import {describe, expect, it} from 'vitest'
import {UiRuntimeRootShell} from '../../src'
import {createRuntimeReactHarness, renderWithStore} from '../support/runtimeReactHarness'

describe('UiRuntimeRootShell', () => {
    it('renders the root shell without introducing router semantics', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithStore(<UiRuntimeRootShell />, harness.store, harness.runtime)

        expect(tree.toJSON()).toBeTruthy()
    })
})
