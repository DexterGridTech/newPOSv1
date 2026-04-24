import {
    defineUiScreenPart,
    uiRuntimeRootVariables,
} from '@next/ui-base-runtime-react'
import {
    SecondaryWelcomeScreen,
    WelcomeScreen,
} from '../ui/screens'

export const cateringShellScreenKeys = {
    welcome: 'ui.integration.catering-shell.welcome',
    secondaryWelcome: 'ui.integration.catering-shell.secondary-welcome',
} as const

export const cateringShellScreenParts = {
    welcome: defineUiScreenPart({
        partKey: cateringShellScreenKeys.welcome,
        rendererKey: cateringShellScreenKeys.welcome,
        name: 'cateringShellWelcome',
        title: '零售欢迎页',
        description: 'Catering shell 业务欢迎页',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['PRIMARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: WelcomeScreen,
    }),
    secondaryWelcome: defineUiScreenPart({
        partKey: cateringShellScreenKeys.secondaryWelcome,
        rendererKey: cateringShellScreenKeys.secondaryWelcome,
        name: 'cateringShellSecondaryWelcome',
        title: '零售副屏欢迎页',
        description: 'Catering shell 副屏欢迎页',
        containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['SECONDARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: SecondaryWelcomeScreen,
    }),
} as const

export const cateringShellScreenDefinitions = Object.values(cateringShellScreenParts)
    .map(part => part.definition)
