import {uiBaseTerminalScreenParts} from '@impos2/ui-base-terminal-console'
import {retailShellScreenParts} from './retailShellScreenParts'

export const retailShellNavigationTargets = {
    activation: uiBaseTerminalScreenParts.activateDeviceScreen,
    welcome: retailShellScreenParts.welcome,
} as const
