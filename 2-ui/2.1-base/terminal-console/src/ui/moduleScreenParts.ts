import {terminalConsoleScreenParts} from '../foundations/terminalScreenParts'

export const uiBaseTerminalScreenParts = {
    activateDeviceScreen: terminalConsoleScreenParts.activateDevice,
    activateDeviceSecondaryScreen: terminalConsoleScreenParts.activateDeviceSecondary,
    terminalSummaryScreen: terminalConsoleScreenParts.terminalSummary,
} as const
