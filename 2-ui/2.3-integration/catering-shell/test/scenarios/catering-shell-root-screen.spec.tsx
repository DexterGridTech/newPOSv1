import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@next/kernel-base-runtime-shell-v2'
import {tcpControlV2StateActions} from '@next/kernel-base-tcp-control-runtime-v2'
import {RootScreen} from '../../src'
import {createCateringShellHarness, renderWithAutomation} from '../support/cateringShellHarness'

vi.mock('@next/ui-base-admin-console', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('@next/ui-base-admin-console')>('@next/ui-base-admin-console')

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

describe('catering-shell root screen', () => {
    it('renders the ui runtime root shell host', async () => {
        const harness = await createCateringShellHarness()
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

        await expect(tree.getNode('ui-integration-catering-shell:root:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
    })

    it('uses the secondary root shell when hosted on displayIndex 1', async () => {
        const harness = await createCateringShellHarness({
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

        await expect(tree.getNode('ui-integration-catering-shell:root:secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-root-shell:secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:secondary')).resolves.toBeTruthy()
    })

    it('opens admin popup through repeated top-left presses', async () => {
        const harness = await createCateringShellHarness()
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
            await automation.press('ui-integration-catering-shell:root')
        }

        await automation.waitForNode('ui-base-admin-popup:login')
    })

    it('opens admin popup through the semantic launcher node', async () => {
        const harness = await createCateringShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-root-003',
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

        await automation.press('ui-integration-catering-shell:admin-launcher')

        await automation.waitForNode('ui-base-admin-popup:login')
    })

    it('shows primary title on primary topology and secondary title on secondary topology', async () => {
        const primaryHarness = await createCateringShellHarness()
        primaryHarness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-workbench-primary',
            activatedAt: Date.now(),
        }))
        await primaryHarness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const primaryAutomation = renderWithAutomation(
            <RootScreen deviceId="DEVICE-PRIMARY" />,
            primaryHarness.store,
            primaryHarness.runtime,
        )
        await expect(
            primaryAutomation.getText('ui-business-catering-master-data-workbench:title'),
        ).resolves.toContain('PRIMARY')

        const secondaryHarness = await createCateringShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })
        secondaryHarness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-workbench-secondary',
            activatedAt: Date.now(),
        }))
        await secondaryHarness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const secondaryAutomation = renderWithAutomation(
            <RootScreen deviceId="DEVICE-SECONDARY" />,
            secondaryHarness.store,
            secondaryHarness.runtime,
        )
        await expect(
            secondaryAutomation.getText('ui-business-catering-master-data-workbench:title'),
        ).resolves.toContain('SECONDARY')
    })
})
