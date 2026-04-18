import {
    defineUiScreenPart,
    uiRuntimeRootVariables,
} from '@impos2/ui-base-runtime-react'
import {
    SecondaryWelcomeScreen,
    WelcomeScreen,
} from '../ui/screens'

export const retailShellScreenKeys = {
    welcome: 'ui.integration.retail-shell.welcome',
    secondaryWelcome: 'ui.integration.retail-shell.secondary-welcome',
} as const

export const retailShellScreenParts = {
    welcome: defineUiScreenPart({
        partKey: retailShellScreenKeys.welcome,
        rendererKey: retailShellScreenKeys.welcome,
        name: 'retailShellWelcome',
        title: '零售欢迎页',
        description: 'Retail shell 业务欢迎页',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['PRIMARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: WelcomeScreen,
    }),
    secondaryWelcome: defineUiScreenPart({
        partKey: retailShellScreenKeys.secondaryWelcome,
        rendererKey: retailShellScreenKeys.secondaryWelcome,
        name: 'retailShellSecondaryWelcome',
        title: '零售副屏欢迎页',
        description: 'Retail shell 副屏欢迎页',
        containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['SECONDARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: SecondaryWelcomeScreen,
    }),
} as const

export const retailShellScreenDefinitions = Object.values(retailShellScreenParts)
    .map(part => part.definition)
