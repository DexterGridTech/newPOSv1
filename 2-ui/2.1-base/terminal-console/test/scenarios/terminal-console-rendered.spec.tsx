import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {tcpControlV2StateActions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    ActivateDeviceScreen,
    TerminalSummaryScreen,
} from '../../src'
import {createTerminalConsoleHarness, renderWithStore} from '../support/terminalConsoleHarness'

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
        const tree = renderWithStore(<ActivateDeviceScreen />, harness.store, harness.runtime)

        expect(() => tree.root.findByProps({testID: 'ui-base-terminal-activate-device'})).not.toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-terminal-activate-device:input'})).not.toThrow()
        expect(() => tree.root.findByProps({testID: 'ui-base-terminal-activate-device:submit'})).not.toThrow()
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

        const summary = renderWithStore(<TerminalSummaryScreen />, harness.store, harness.runtime)

        expect(summary.toJSON()).toBeTruthy()
        expect(() => summary.root.findByProps({testID: 'ui-base-terminal-summary'})).not.toThrow()
        expect(String(summary.root.findByProps({testID: 'ui-base-terminal-summary:description'}).props.children))
            .toContain('终端已完成激活')
    })
})
