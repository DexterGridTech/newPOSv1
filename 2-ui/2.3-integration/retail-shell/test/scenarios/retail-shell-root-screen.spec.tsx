import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2StateActions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {RootScreen} from '../../src'
import {createRetailShellHarness, renderWithAutomation} from '../support/retailShellHarness'

vi.mock('@impos2/ui-base-admin-console', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('@impos2/ui-base-admin-console')>('@impos2/ui-base-admin-console')

    return {
        ...actual,
        AdminPopup: ({deviceId, onClose}: {deviceId: string; onClose: () => void}) =>
            ReactModule.createElement('mock-admin-popup', {
                testID: 'ui-base-admin-popup:login',
                deviceId,
                onClose,
            }),
    }
})

describe('retail-shell root screen', () => {
    it('renders the ui runtime root shell host', async () => {
        const harness = await createRetailShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-root-001',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const tree = renderWithAutomation(
            <RootScreen deviceId="DEVICE-001" />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-integration-retail-shell:root:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
    })

    it('uses the secondary root shell when hosted on displayIndex 1', async () => {
        const harness = await createRetailShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const tree = renderWithAutomation(
            <RootScreen deviceId="DEVICE-SECONDARY" />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-integration-retail-shell:root:secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-root-shell:secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:secondary')).resolves.toBeTruthy()
    })

    it('opens admin popup through repeated top-left presses', async () => {
        const harness = await createRetailShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-root-002',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const automation = renderWithAutomation(
            <RootScreen deviceId="DEVICE-001" />,
            harness.store,
            harness.runtime,
        )

        for (let index = 0; index < 5; index += 1) {
            await automation.press('ui-integration-retail-shell:root')
        }

        await automation.waitForNode('ui-base-admin-popup:login')
    })
})
