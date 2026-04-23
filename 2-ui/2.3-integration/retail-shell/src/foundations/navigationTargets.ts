import {uiBaseTerminalScreenParts} from '@impos2/ui-base-terminal-console'
import {masterDataWorkbenchScreenParts} from '@impos2/ui-business-catering-master-data-workbench'
import {retailShellScreenParts} from './retailShellScreenParts'

export const retailShellNavigationTargets = {
    activation: uiBaseTerminalScreenParts.activateDeviceScreen,
    activationSecondary: uiBaseTerminalScreenParts.activateDeviceSecondaryScreen,
    welcome: retailShellScreenParts.welcome,
    welcomeSecondary: retailShellScreenParts.secondaryWelcome,
    masterDataWorkbenchPrimary: masterDataWorkbenchScreenParts.primaryWorkbench,
    masterDataWorkbenchSecondary: masterDataWorkbenchScreenParts.secondaryWorkbench,
} as const
