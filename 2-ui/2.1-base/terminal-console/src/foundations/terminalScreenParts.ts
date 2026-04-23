import {
    defineUiScreenPart,
    uiRuntimeRootVariables,
} from '@impos2/ui-base-runtime-react'
import {ActivateDeviceScreen} from '../ui/screens/ActivateDeviceScreen'
import {ActivateDeviceSecondaryScreen} from '../ui/screens/ActivateDeviceSecondaryScreen'
import {TerminalSummaryScreen} from '../ui/screens/TerminalSummaryScreen'

export const terminalConsoleScreenKeys = {
    activateDevice: 'ui.base.terminal.activate-device',
    activateDeviceSecondary: 'ui.base.terminal.activate-device-secondary',
    terminalSummary: 'ui.base.terminal.summary',
} as const

export const terminalConsoleScreenParts = {
    activateDevice: defineUiScreenPart({
        partKey: terminalConsoleScreenKeys.activateDevice,
        rendererKey: terminalConsoleScreenKeys.activateDevice,
        name: 'activateDevice',
        title: '设备激活',
        description: '终端激活入口',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['PRIMARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: ActivateDeviceScreen,
    }),
    activateDeviceSecondary: defineUiScreenPart({
        partKey: terminalConsoleScreenKeys.activateDeviceSecondary,
        rendererKey: terminalConsoleScreenKeys.activateDeviceSecondary,
        name: 'activateDeviceSecondary',
        title: '等待设备激活',
        description: '副屏等待主屏完成设备激活',
        containerKey: uiRuntimeRootVariables.secondaryRootContainer.key,
        indexInContainer: 10,
        screenModes: ['PRIMARY', 'SECONDARY', 'DESKTOP'],
        workspaces: ['main', 'branch'],
        instanceModes: ['MASTER', 'SLAVE'],
        component: ActivateDeviceSecondaryScreen,
    }),
    terminalSummary: defineUiScreenPart({
        partKey: terminalConsoleScreenKeys.terminalSummary,
        rendererKey: terminalConsoleScreenKeys.terminalSummary,
        name: 'terminalSummary',
        title: '终端连接摘要',
        description: '展示终端激活和凭证状态',
        containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
        indexInContainer: 20,
        screenModes: ['PRIMARY', 'DESKTOP'],
        workspaces: ['main'],
        instanceModes: ['STANDALONE', 'MASTER', 'SLAVE'],
        component: TerminalSummaryScreen,
    }),
} as const

export const terminalConsoleScreenDefinitions = Object.values(terminalConsoleScreenParts)
    .map(part => part.definition)
