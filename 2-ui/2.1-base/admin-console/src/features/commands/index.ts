import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {AdminTopologySharePayload} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const adminConsoleCommandDefinitions = {
    scanAndImportTopologyMaster: defineModuleCommand<{
        scanMode?: string
        imageUri?: string
        imageBase64?: string
        timeoutMs?: number
        reconnect?: boolean
    }>('scan-and-import-topology-master', {
        timeoutMs: 90_000,
    }),
    clearTopologyMasterLocator: defineModuleCommand<Record<string, never>>('clear-topology-master-locator'),
    refreshTopologyHostStatus: defineModuleCommand<Record<string, never>>('refresh-topology-host-status'),
    generateTopologySharePayload: defineModuleCommand<Record<string, never>>('generate-topology-share-payload'),
    importTopologySharePayload: defineModuleCommand<{
        sharePayload: AdminTopologySharePayload
    }>('import-topology-share-payload'),
    reconnectTopologyHost: defineModuleCommand<Record<string, never>>('reconnect-topology-host'),
    stopTopologyHost: defineModuleCommand<Record<string, never>>('stop-topology-host'),
    switchServerSpace: defineModuleCommand<{
        selectedSpace: string
    }>('switch-server-space'),
} as const

export const adminConsoleCommandNames = Object.fromEntries(
    Object.entries(adminConsoleCommandDefinitions).map(([key, definition]) => [
        key,
        definition.commandName,
    ]),
) as {
    readonly [K in keyof typeof adminConsoleCommandDefinitions]: typeof adminConsoleCommandDefinitions[K]['commandName']
}
