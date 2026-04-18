import {describe, expect, it} from 'vitest'
import {
    selectUiScreenDefinition,
    uiRuntimeV2CommandDefinitions,
} from '@impos2/kernel-base-ui-runtime-v2'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTerminalConsoleHarness,
} from '../support/terminalConsoleHarness'
import {
    terminalConsoleScreenDefinitions,
    terminalConsoleScreenKeys,
    terminalConsoleScreenParts,
} from '../../src'

describe('terminal console screen parts', () => {
    it('exposes stable part definitions for terminal flows', () => {
        expect(terminalConsoleScreenParts.activateDevice.definition.partKey)
            .toBe(terminalConsoleScreenKeys.activateDevice)
        expect(terminalConsoleScreenParts.activateDeviceSecondary.definition.partKey)
            .toBe(terminalConsoleScreenKeys.activateDeviceSecondary)
        expect(terminalConsoleScreenParts.terminalSummary.definition.partKey)
            .toBe(terminalConsoleScreenKeys.terminalSummary)
        expect(terminalConsoleScreenDefinitions).toHaveLength(3)
    })

    it('registers terminal screen definitions into ui-runtime-v2 during module install', async () => {
        const harness = await createTerminalConsoleHarness()

        expect(selectUiScreenDefinition(terminalConsoleScreenKeys.activateDevice)?.rendererKey)
            .toBe(terminalConsoleScreenKeys.activateDevice)
        expect(selectUiScreenDefinition(terminalConsoleScreenKeys.activateDeviceSecondary)?.rendererKey)
            .toBe(terminalConsoleScreenKeys.activateDeviceSecondary)
        expect(selectUiScreenDefinition(terminalConsoleScreenKeys.terminalSummary)?.rendererKey)
            .toBe(terminalConsoleScreenKeys.terminalSummary)

        const result = await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: terminalConsoleScreenDefinitions,
            },
        ))

        expect(result.status).toBe('COMPLETED')
    })
})
