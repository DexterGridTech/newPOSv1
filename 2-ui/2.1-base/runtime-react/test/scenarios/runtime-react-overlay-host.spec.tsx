import React from 'react'
import {describe, expect, it} from 'vitest'
import {OverlayHost} from '../../src'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'

describe('OverlayHost', () => {
    it('renders an empty overlay host when no overlays are active', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(<OverlayHost />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-overlay-host')).resolves.toBeTruthy()
    })
})
