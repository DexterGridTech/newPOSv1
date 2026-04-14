import {createModuleCommandFactory} from '../../supports/moduleDsl'
import {moduleName} from '../../moduleName'
import type {ErrorCatalogEntry, ParameterCatalogEntry} from '@impos2/kernel-base-contracts'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const runtimeShellV2CommandDefinitions = {
    initialize: defineModuleCommand<Record<string, never>>('initialize', {
        visibility: 'internal',
        allowNoActor: true,
    }),
    upsertErrorCatalogEntries: defineModuleCommand<{
        entries: ErrorCatalogEntry[]
    }>('upsert-error-catalog-entries', {
        visibility: 'internal',
    }),
    removeErrorCatalogEntries: defineModuleCommand<{
        keys: string[]
    }>('remove-error-catalog-entries', {
        visibility: 'internal',
    }),
    upsertParameterCatalogEntries: defineModuleCommand<{
        entries: ParameterCatalogEntry[]
    }>('upsert-parameter-catalog-entries', {
        visibility: 'internal',
    }),
    removeParameterCatalogEntries: defineModuleCommand<{
        keys: string[]
    }>('remove-parameter-catalog-entries', {
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
