import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const topologyRuntimeV3CommandDefinitions = {
    setInstanceMode: defineModuleCommand<{instanceMode: 'MASTER' | 'SLAVE'}>('set-instance-mode'),
    setDisplayMode: defineModuleCommand<{displayMode: 'PRIMARY' | 'SECONDARY'}>('set-display-mode'),
    requestPowerDisplayModeSwitchConfirmation: defineModuleCommand<{
        displayMode: 'PRIMARY' | 'SECONDARY'
        reason: 'power-status-change'
        powerConnected: boolean
    }>('request-power-display-mode-switch-confirmation', {
        allowNoActor: true,
    }),
    confirmPowerDisplayModeSwitch: defineModuleCommand<{
        displayMode: 'PRIMARY' | 'SECONDARY'
    }>('confirm-power-display-mode-switch'),
    setEnableSlave: defineModuleCommand<{enableSlave: boolean}>('set-enable-slave'),
    setMasterLocator: defineModuleCommand<{
        masterLocator: {
            masterNodeId?: string
            masterDeviceId?: string
            serverAddress: Array<{address: string}>
            httpBaseUrl?: string
            addedAt: number
        }
    }>('set-master-locator'),
    clearMasterLocator: defineModuleCommand<Record<string, never>>('clear-master-locator'),
    syncTopologyHostLifecycle: defineModuleCommand<Record<string, never>>('sync-topology-host-lifecycle'),
    updateTopologyHostBinding: defineModuleCommand<{
        wsUrl?: string
        httpBaseUrl?: string
    }>('update-topology-host-binding'),
    refreshTopologyContext: defineModuleCommand<Record<string, never>>('refresh-topology-context'),
    startTopologyConnection: defineModuleCommand<Record<string, never>>('start-topology-connection'),
    stopTopologyConnection: defineModuleCommand<Record<string, never>>('stop-topology-connection'),
    restartTopologyConnection: defineModuleCommand<Record<string, never>>('restart-topology-connection'),
    upsertDemoMasterEntry: defineModuleCommand<{
        entryKey: string
        label: string
        phase: 'UNACTIVATED' | 'ACTIVATED' | 'DEBUG'
        note?: string
        updatedAt: number
    }>('upsert-demo-master-entry'),
    removeDemoMasterEntry: defineModuleCommand<{
        entryKey: string
    }>('remove-demo-master-entry'),
    resetDemoMasterState: defineModuleCommand<Record<string, never>>('reset-demo-master-state'),
    upsertDemoSlaveEntry: defineModuleCommand<{
        entryKey: string
        label: string
        phase: 'UNACTIVATED' | 'ACTIVATED' | 'DEBUG'
        note?: string
        updatedAt: number
    }>('upsert-demo-slave-entry'),
    removeDemoSlaveEntry: defineModuleCommand<{
        entryKey: string
    }>('remove-demo-slave-entry'),
    resetDemoSlaveState: defineModuleCommand<Record<string, never>>('reset-demo-slave-state'),
} as const

export const topologyRuntimeV3CommandNames = Object.fromEntries(
    Object.entries(topologyRuntimeV3CommandDefinitions).map(([key, definition]) => [
        key,
        definition.commandName,
    ]),
) as {
    readonly [K in keyof typeof topologyRuntimeV3CommandDefinitions]: typeof topologyRuntimeV3CommandDefinitions[K]['commandName']
}
