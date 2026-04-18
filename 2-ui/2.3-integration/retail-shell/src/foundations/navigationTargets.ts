import {uiBaseTerminalScreenParts} from '@impos2/ui-base-terminal-console'
import {retailShellScreenParts} from './retailShellScreenParts'

export const retailShellNavigationTargets = {
    activation: uiBaseTerminalScreenParts.activateDeviceScreen,
    activationSecondary: uiBaseTerminalScreenParts.activateDeviceSecondaryScreen,
    welcome: retailShellScreenParts.welcome,
    welcomeSecondary: retailShellScreenParts.secondaryWelcome,
} as const
