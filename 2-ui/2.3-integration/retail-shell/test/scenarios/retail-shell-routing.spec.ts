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
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {createRetailShellHarness} from '../support/retailShellHarness'

const selectPrimaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.primaryRootContainer.key)

const selectSecondaryRoot = (state: RootState) =>
    selectUiScreen(state, uiRuntimeRootVariables.secondaryRootContainer.key)

describe('retail-shell routing', () => {
    it('routes to activation screen on initialize when terminal is not activated', async () => {
        const harness = await createRetailShellHarness()
        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())

        expect(current?.partKey).toBe('ui.base.terminal.activate-device')
        expect(secondary?.partKey).toBe('ui.base.terminal.activate-device-secondary')
    })

    it('rebuilds the secondary root to activation on initialize when stale welcome state is persisted', async () => {
        const harness = await createRetailShellHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-secondary-stale',
                accessToken: 'token-secondary-stale',
            },
        ))
        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.integration.retail-shell.secondary-welcome',
        )

        harness.store.dispatch(tcpControlV2StateActions.clearActivation())

        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        expect(selectSecondaryRoot(harness.runtime.getState())?.partKey).toBe(
            'ui.base.terminal.activate-device-secondary',
        )
    })

    it('routes to welcome screen on initialize when terminal is already activated', async () => {
        const harness = await createRetailShellHarness()

        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-001',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.integration.retail-shell.welcome')
        expect(secondary?.partKey).toBe('ui.integration.retail-shell.secondary-welcome')
        expect((current?.props as {terminalId?: string} | undefined)?.terminalId).toBe('terminal-001')
    })

    it('switches to welcome screen after activation succeeds', async () => {
        const harness = await createRetailShellHarness()

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-002',
                accessToken: 'token-002',
            },
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.integration.retail-shell.welcome')
        expect(secondary?.partKey).toBe('ui.integration.retail-shell.secondary-welcome')
        expect((current?.props as {terminalId?: string} | undefined)?.terminalId).toBe('terminal-002')
    })

    it('switches back to activation screen after deactivation succeeds', async () => {
        const harness = await createRetailShellHarness()

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.activateTerminalSucceeded,
            {
                terminalId: 'terminal-003',
                accessToken: 'token-003',
            },
        ))

        await harness.runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.deactivateTerminalSucceeded,
            {
                terminalId: 'terminal-003',
            },
        ))

        const current = selectPrimaryRoot(harness.runtime.getState())
        const secondary = selectSecondaryRoot(harness.runtime.getState())
        expect(current?.partKey).toBe('ui.base.terminal.activate-device')
        expect(secondary?.partKey).toBe('ui.base.terminal.activate-device-secondary')
    })
})
