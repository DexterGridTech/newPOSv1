import {createModuleCommandFactory} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {TransportServerConfig} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const transportRuntimeCommandDefinitions = {
    initializeServerSpace: defineModuleCommand<{
        config: TransportServerConfig
        selectedSpace?: string
    }>('initialize-server-space'),
    setSelectedServerSpace: defineModuleCommand<{
        selectedSpace: string
    }>('set-selected-server-space'),
} as const

export const transportRuntimeCommandNames = Object.fromEntries(
    Object.entries(transportRuntimeCommandDefinitions).map(([key, definition]) => [
        key,
        definition.commandName,
    ]),
) as {
    readonly [K in keyof typeof transportRuntimeCommandDefinitions]: typeof transportRuntimeCommandDefinitions[K]['commandName']
}
