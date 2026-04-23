import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createUiNavigationBridge} from '@impos2/ui-base-runtime-react'
import {uiBaseTerminalScreenParts} from '../ui/moduleScreenParts'

export const createTerminalConsoleNavigation = (
    runtime: KernelRuntimeV2,
) => {
    const navigation = createUiNavigationBridge(runtime)

    return {
        showActivation() {
            return navigation.navigateTo({
                target: uiBaseTerminalScreenParts.activateDeviceScreen,
                source: 'ui-base-terminal-console',
            })
        },
        showSummary() {
            return navigation.navigateTo({
                target: uiBaseTerminalScreenParts.terminalSummaryScreen,
                source: 'ui-base-terminal-console',
            })
        },
    }
}
