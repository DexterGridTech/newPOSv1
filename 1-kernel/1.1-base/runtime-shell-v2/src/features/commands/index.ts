import {defineCommand} from '../../foundations/command'
import {moduleName} from '../../moduleName'
import type {ErrorCatalogEntry, ParameterCatalogEntry} from '@impos2/kernel-base-contracts'

export const runtimeShellV2CommandDefinitions = {
    initialize: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'initialize',
        visibility: 'internal',
        allowNoActor: true,
    }),
    upsertErrorCatalogEntries: defineCommand<{
        entries: ErrorCatalogEntry[]
    }>({
        moduleName,
        commandName: 'upsert-error-catalog-entries',
        visibility: 'internal',
    }),
    removeErrorCatalogEntries: defineCommand<{
        keys: string[]
    }>({
        moduleName,
        commandName: 'remove-error-catalog-entries',
        visibility: 'internal',
    }),
    upsertParameterCatalogEntries: defineCommand<{
        entries: ParameterCatalogEntry[]
    }>({
        moduleName,
        commandName: 'upsert-parameter-catalog-entries',
        visibility: 'internal',
    }),
    removeParameterCatalogEntries: defineCommand<{
        keys: string[]
    }>({
        moduleName,
        commandName: 'remove-parameter-catalog-entries',
        visibility: 'internal',
    }),
} as const

export const runtimeShellV2CommandNames = {
    initialize: runtimeShellV2CommandDefinitions.initialize.commandName,
    upsertErrorCatalogEntries: runtimeShellV2CommandDefinitions.upsertErrorCatalogEntries.commandName,
    removeErrorCatalogEntries: runtimeShellV2CommandDefinitions.removeErrorCatalogEntries.commandName,
    upsertParameterCatalogEntries: runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries.commandName,
    removeParameterCatalogEntries: runtimeShellV2CommandDefinitions.removeParameterCatalogEntries.commandName,
} as const
