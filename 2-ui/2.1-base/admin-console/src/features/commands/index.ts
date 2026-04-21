import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const adminConsoleCommandDefinitions = {
    scanAndImportTopologyMaster: defineModuleCommand<{
        scanMode?: string
        timeoutMs?: number
        reconnect?: boolean
    }>('scan-and-import-topology-master', {
        timeoutMs: 90_000,
    }),
} as const

export const adminConsoleCommandNames = Object.fromEntries(
    Object.entries(adminConsoleCommandDefinitions).map(([key, definition]) => [
        key,
        definition.commandName,
    ]),
) as {
    readonly [K in keyof typeof adminConsoleCommandDefinitions]: typeof adminConsoleCommandDefinitions[K]['commandName']
}
