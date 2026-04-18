import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {UiRuntimeRootShell} from '../../src/ui/components/UiRuntimeRootShell'
import type {RuntimeReactAutomationBridge} from '../../src/types'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'

describe('runtime-react automation registration', () => {
    it('keeps stable testIDs on root automation anchors', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(<UiRuntimeRootShell display="primary" />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-overlay-host')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-alert-host')).resolves.toBeTruthy()
    })

    it('registers semantic anchors only when a bridge is injected', async () => {
        const harness = await createRuntimeReactHarness()
        const registerNode = vi.fn(() => () => {})
        const bridge: RuntimeReactAutomationBridge = {
            registerNode,
            updateNode: vi.fn(),
            clearVisibleContexts: vi.fn(),
            clearTarget: vi.fn(),
        }

        renderWithAutomation(
            <UiRuntimeRootShell
                display="primary"
                automationBridge={bridge}
                automationRuntimeId="primary-1"
            />,
            harness.store,
            harness.runtime,
        )

        expect(registerNode).toHaveBeenCalled()
    })
})
