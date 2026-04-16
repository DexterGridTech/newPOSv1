import React from 'react'
import {describe, expect, it} from 'vitest'
import {OverlayHost} from '../../src'
import {createRuntimeReactHarness, renderWithStore} from '../support/runtimeReactHarness'

describe('OverlayHost', () => {
    it('renders an empty overlay host when no overlays are active', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithStore(<OverlayHost />, harness.store, harness.runtime)

        expect(tree.toJSON()).toBeTruthy()
    })
})
