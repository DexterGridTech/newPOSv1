import {DefaultAlert} from '../ui/components/DefaultAlert'
import {EmptyScreen} from '../ui/components/EmptyScreen'
import {defineUiAlertPart} from './defineUiAlertPart'
import {defineUiScreenPart} from './defineUiScreenPart'
import {uiRuntimeRootVariables} from './uiVariables'

export const runtimeReactDefaultParts = {
    emptyScreen: defineUiScreenPart({
        partKey: 'ui.base.empty-screen',
        rendererKey: 'ui.base.empty-screen',
        name: 'emptyScreen',
        title: 'Empty Screen',
        description: 'Fallback empty screen for empty containers',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'branch'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: EmptyScreen,
    }),
    defaultAlert: defineUiAlertPart({
        partKey: 'ui.base.default-alert',
        rendererKey: 'ui.base.default-alert',
        name: 'defaultAlert',
        title: 'Default Alert',
        description: 'Default alert renderer',
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'branch'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: DefaultAlert,
    }),
} as const
