import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2StateActions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {topologyRuntimeV2CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v2'
import {
    ActivateDeviceScreen,
    ActivateDeviceSecondaryScreen,
    TerminalSummaryScreen,
} from '../../src'
import {createTerminalConsoleHarness, renderWithAutomation} from '../support/terminalConsoleHarness'

vi.mock('react-native', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('react-native')>('react-native')

    return {
        ...actual,
        TextInput: (props: Record<string, unknown>) => ReactModule.createElement('mock-text-input', props),
    }
})

describe('terminal-console screens', () => {
    it('renders activation screen with stable call-to-action nodes', async () => {
        const harness = await createTerminalConsoleHarness()
        const tree = renderWithAutomation(<ActivateDeviceScreen />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-terminal-activate-device')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:title')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:input')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:identity')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:device-id')).resolves.toBeTruthy()
    })

    it('renders secondary waiting screen with stable terminal context nodes', async () => {
        const harness = await createTerminalConsoleHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })
        await act(async () => {
            await harness.runtime.dispatchCommand(createCommand(
                topologyRuntimeV2CommandDefinitions.setDisplayMode,
                {
                    displayMode: 'SECONDARY',
                },
            ))
            harness.store.dispatch(tcpControlV2StateActions.setDeviceInfo({
                id: 'DEVICE-SECONDARY-001',
                model: 'Renderer POS Secondary',
            }))
        })

        const tree = renderWithAutomation(<ActivateDeviceSecondaryScreen />, harness.store, harness.runtime)
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:device-id')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:display-mode')).resolves.toBeTruthy()
    })

    it('renders summary screen against the kernel runtime', async () => {
        const harness = await createTerminalConsoleHarness()
        await act(async () => {
            harness.store.dispatch(tcpControlV2StateActions.setDeviceInfo({
                id: 'DEVICE-RENDER-001',
                model: 'Renderer POS',
            }))
            harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
                terminalId: 'terminal-render-001',
                activatedAt: 1_765_400_000_000 as any,
            }))
            harness.store.dispatch(tcpControlV2StateActions.setCredential({
                accessToken: 'token-render-001',
                refreshToken: 'refresh-render-001',
                expiresAt: 1_765_500_000_000 as any,
                updatedAt: 1_765_450_000_000 as any,
            }))
        })

        const summary = renderWithAutomation(<TerminalSummaryScreen />, harness.store, harness.runtime)

        await expect(summary.getNode('ui-base-terminal-summary')).resolves.toBeTruthy()
        await expect(summary.getText('ui-base-terminal-summary:description'))
            .resolves.toContain('终端已完成激活')
    })
})
