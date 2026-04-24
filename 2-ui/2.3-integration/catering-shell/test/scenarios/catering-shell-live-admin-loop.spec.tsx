import React from 'react'
import {describe, expect, it} from 'vitest'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@next/kernel-base-runtime-shell-v2'
import {
    selectTcpIdentitySnapshot,
    tcpControlV2CommandDefinitions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    selectUiScreen,
} from '@next/kernel-base-ui-runtime-v2'
import {
    uiRuntimeRootVariables,
} from '@next/ui-base-runtime-react'
import {AdminTerminalSection} from '@next/ui-base-admin-console'
import type {RootState} from '@next/kernel-base-state-runtime'
import {
    createCateringShellLiveHarness,
    renderWithAutomation,
    waitFor,
} from '../support/cateringShellLiveHarness'

const selectPrimaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.primaryRootContainer.key)

describe('catering-shell live admin deactivation loop', () => {
    it('activates against mock-terminal-platform and returns to activation screen after admin deactivation', async () => {
        const harness = await createCateringShellLiveHarness()

        try {
            const activationCodes = await harness.platform.admin.activationCodes()
            const activationCode = activationCodes.find(item => item.status === 'AVAILABLE')?.code

            expect(activationCode).toBeTruthy()
            expect(selectPrimaryRoot(harness.runtime.getState())?.partKey).toBe('ui.base.terminal.activate-device')

            await harness.runtime.dispatchCommand(createCommand(
                runtimeShellV2CommandDefinitions.initialize,
                {},
            ))
            await harness.runtime.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.bootstrapTcpControl,
                {
                    deviceInfo: {
                        id: 'DEVICE-LIVE-001',
                        model: 'Catering Shell Live Mock POS',
                    },
                },
            ))
            await harness.runtime.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.activateTerminal,
                {
                    sandboxId: harness.platform.prepare.sandboxId,
                    activationCode: activationCode!,
                },
            ))

            await waitFor(() =>
                selectPrimaryRoot(harness.runtime.getState())?.partKey === 'ui.business.catering-master-data-workbench.primary-workbench',
            )

            const welcomeState = harness.runtime.getState()
            const terminalId = selectTcpIdentitySnapshot(welcomeState).terminalId

            expect(terminalId).toBeTruthy()
            expect(selectPrimaryRoot(welcomeState)?.partKey).toBe('ui.business.catering-master-data-workbench.primary-workbench')

            const tree = renderWithAutomation(
                <AdminTerminalSection runtime={harness.runtime} store={harness.store} />,
                harness.store,
                harness.runtime,
            )

            await tree.press('ui-base-admin-section:terminal:deactivate')
            await tree.waitForIdle()

            await waitFor(() =>
                selectTcpIdentitySnapshot(harness.runtime.getState()).activationStatus === 'UNACTIVATED'
                && selectPrimaryRoot(harness.runtime.getState())?.partKey === 'ui.base.terminal.activate-device',
            )
            await waitFor(async () => {
                const terminals = await harness.platform.admin.terminals()
                return terminals.some(item => item.terminalId === terminalId && item.lifecycleStatus === 'DEACTIVATED')
            })

            const terminals = await harness.platform.admin.terminals()
            expect(terminals.find(item => item.terminalId === terminalId)).toMatchObject({
                lifecycleStatus: 'DEACTIVATED',
            })
            expect(selectTcpIdentitySnapshot(harness.runtime.getState()).activationStatus).toBe('UNACTIVATED')
            expect(selectPrimaryRoot(harness.runtime.getState())?.partKey).toBe('ui.base.terminal.activate-device')

            await harness.runtime.flushPersistence()
            const stateKeys = await harness.storagePair.stateStorage.storage.getAllKeys?.()
            const secureKeys = await harness.storagePair.secureStateStorage.storage.getAllKeys?.()
            expect((stateKeys ?? []).some(key => key.endsWith(':terminalId'))).toBe(false)
            expect((secureKeys ?? []).some(key => key.endsWith(':accessToken'))).toBe(false)
            expect((secureKeys ?? []).some(key => key.endsWith(':refreshToken'))).toBe(false)
        } finally {
            await harness.cleanup()
        }
    })
})
