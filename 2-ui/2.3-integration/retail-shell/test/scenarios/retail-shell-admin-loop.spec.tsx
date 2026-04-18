import React from 'react'
import {describe, expect, it} from 'vitest'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectUiScreen,
} from '@impos2/kernel-base-ui-runtime-v2'
import {
    uiRuntimeRootVariables,
} from '@impos2/ui-base-runtime-react'
import {
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {AdminTerminalSection} from '@impos2/ui-base-admin-console'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {createRetailShellHarness, renderWithAutomation} from '../support/retailShellHarness'

const selectPrimaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.primaryRootContainer.key)

describe('retail-shell admin deactivation loop', () => {
    it('returns from welcome screen to activation screen through admin deactivation', async () => {
        const harness = await createRetailShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-admin-loop',
            activatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setCredential({
            accessToken: 'token-admin-loop',
            refreshToken: 'refresh-admin-loop',
            expiresAt: Date.now() + 60_000,
            updatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))
        expect(selectPrimaryRoot(harness.runtime.getState())?.partKey)
            .toBe('ui.integration.retail-shell.welcome')

        const tree = renderWithAutomation(
            <AdminTerminalSection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-admin-section:terminal:deactivate')
        await tree.waitForIdle()

        const state = harness.runtime.getState()
        expect(selectTcpIdentitySnapshot(state).activationStatus).toBe('UNACTIVATED')
        expect(selectTcpCredentialSnapshot(state).status).toBe('EMPTY')
        expect(selectPrimaryRoot(state)?.partKey).toBe('ui.base.terminal.activate-device')
    })
})
