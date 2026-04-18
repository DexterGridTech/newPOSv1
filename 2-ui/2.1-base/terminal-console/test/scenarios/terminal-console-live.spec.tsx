import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    createCommand,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTcpIdentitySnapshot,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    ActivateDeviceScreen,
    TerminalSummaryScreen,
} from '../../src'
import {
    createTerminalConsoleLiveHarness,
    fetchJson,
    renderTerminalConsoleLive,
    waitFor,
} from '../support/terminalConsoleLiveHarness'
import {renderWithAutomation} from '../support/terminalConsoleHarness'

vi.mock('react-native', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('react-native')>('react-native')

    return {
        ...actual,
        TextInput: (props: Record<string, unknown>) => ReactModule.createElement('mock-text-input', props),
    }
})

describe('terminal-console live', () => {
    it('activates against mock-terminal-platform and exposes updated summary data', async () => {
        const harness = await createTerminalConsoleLiveHarness()

        try {
            await harness.runtime.dispatchCommand(
                createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
                    deviceInfo: {
                        id: 'TERMINAL-CONSOLE-LIVE-DEVICE-001',
                        model: 'Terminal Console Live Mock POS',
                    },
                }),
                {requestId: createRequestId()},
            )

            const activationCodes = await fetchJson<Array<{code: string; status: string}>>(
                `${harness.platform.baseUrl}/api/v1/admin/activation-codes`,
            )
            const activationCode = activationCodes.find(item => item.status === 'AVAILABLE')?.code
            expect(activationCode).toBeTruthy()

            const activationAutomation = renderWithAutomation(
                <ActivateDeviceScreen />,
                harness.store,
                harness.runtime,
            )

            await activationAutomation.changeText('ui-base-terminal-activate-device:input', activationCode!)

            let submitResult: unknown
            submitResult = await activationAutomation.client.call('ui.performAction', {
                target: 'primary',
                nodeId: 'ui-base-terminal-activate-device:submit',
                action: 'press',
            })

            try {
                await waitFor(() =>
                    selectTcpIdentitySnapshot(harness.runtime.getState()).activationStatus === 'ACTIVATED',
                    10_000,
                )
            } catch (error) {
                const identity = selectTcpIdentitySnapshot(harness.runtime.getState())
                throw new Error([
                    error instanceof Error ? error.message : String(error),
                    `submitResult=${JSON.stringify(submitResult)}`,
                    `identity=${JSON.stringify(identity)}`,
                ].join('\n'))
            }

            const summaryAutomation = renderWithAutomation(
                <TerminalSummaryScreen />,
                harness.store,
                harness.runtime,
            )

            const identity = selectTcpIdentitySnapshot(harness.runtime.getState())
            expect(identity.terminalId).toBeTruthy()
            await expect(summaryAutomation.getText('ui-base-terminal-summary:description'))
                .resolves.toContain('终端已完成激活')
        } finally {
            await harness.cleanup()
        }
    }, 30_000)
})
