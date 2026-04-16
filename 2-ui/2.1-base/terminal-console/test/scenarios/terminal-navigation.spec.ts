import {describe, expect, it, vi} from 'vitest'
import {uiBaseTerminalScreenParts, createTerminalConsoleNavigation} from '../../src'

describe('terminal console authoring surface', () => {
    it('exports moduleScreenParts-style references for business modules', () => {
        expect(uiBaseTerminalScreenParts.activateDeviceScreen.definition.partKey)
            .toBe('ui.base.terminal.activate-device')
        expect(uiBaseTerminalScreenParts.terminalSummaryScreen.definition.partKey)
            .toBe('ui.base.terminal.summary')
    })

    it('wraps ui navigation bridge with stable terminal intents', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))
        const navigation = createTerminalConsoleNavigation({
            dispatchCommand,
        } as any)

        await navigation.showActivation()
        await navigation.showSummary()

        expect(dispatchCommand).toHaveBeenCalledTimes(2)
    })
})
