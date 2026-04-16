import {terminalConsoleScreenParts} from '../foundations/terminalScreenParts'

export const uiBaseTerminalScreenParts = {
    activateDeviceScreen: terminalConsoleScreenParts.activateDevice,
    terminalSummaryScreen: terminalConsoleScreenParts.terminalSummary,
} as const
