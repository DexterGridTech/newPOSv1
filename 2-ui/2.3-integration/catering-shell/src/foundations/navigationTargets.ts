import {uiBaseTerminalScreenParts} from '@impos2/ui-base-terminal-console'
import {masterDataWorkbenchScreenParts} from '@impos2/ui-business-catering-master-data-workbench'
import {cateringShellScreenParts} from './cateringShellScreenParts'

export const cateringShellNavigationTargets = {
    activation: uiBaseTerminalScreenParts.activateDeviceScreen,
    activationSecondary: uiBaseTerminalScreenParts.activateDeviceSecondaryScreen,
    welcome: cateringShellScreenParts.welcome,
    welcomeSecondary: cateringShellScreenParts.secondaryWelcome,
    masterDataWorkbenchPrimary: masterDataWorkbenchScreenParts.primaryWorkbench,
    masterDataWorkbenchSecondary: masterDataWorkbenchScreenParts.secondaryWorkbench,
} as const
