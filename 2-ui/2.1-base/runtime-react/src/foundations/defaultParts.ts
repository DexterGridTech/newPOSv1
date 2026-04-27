import {DefaultAlert} from '../ui/components/DefaultAlert'
import {EmptyScreen} from '../ui/components/EmptyScreen'
import {HotUpdateProgressModal} from '../ui/components/HotUpdateProgressModal'
import {LoadingScreen} from '../ui/components/LoadingScreen'
import {defineUiAlertPart} from './defineUiAlertPart'
import {defineUiModalPart} from './defineUiModalPart'
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
    loadingScreen: defineUiScreenPart<{label?: string; testID?: string}>({
        partKey: 'ui.base.loading-screen',
        rendererKey: 'ui.base.loading-screen',
        name: 'loadingScreen',
        title: 'Loading Screen',
        description: 'Fallback loading screen for deferred containers',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'branch'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: LoadingScreen,
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
    hotUpdateProgressModal: defineUiModalPart<{
        title?: string
        countdownSeconds?: number
    }>({
        partKey: 'ui.base.hot-update-progress-modal',
        rendererKey: 'ui.base.hot-update-progress-modal',
        name: 'hotUpdateProgressModal',
        title: 'Hot Update Progress Modal',
        description: 'Modal shown before hot update restart',
        screenModes: ['DESKTOP', 'MOBILE'],
        workspaces: ['main', 'branch'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: HotUpdateProgressModal,
    }),
} as const
