import {nowTimestampMs, type ParameterDefinition} from '@next/kernel-base-contracts'
import type {UnknownAction} from '@reduxjs/toolkit'
import type {KernelRuntimeModuleV2} from '../types'
import {runtimeShellV2StateActions} from '../features/slices'

const toCatalogErrorEntry = (definition: {
    key: string
    defaultTemplate: string
}) => ({
    key: definition.key,
    template: definition.defaultTemplate,
    updatedAt: nowTimestampMs(),
    source: 'default' as const,
})

const toCatalogParameterEntry = <TValue>(definition: ParameterDefinition<TValue>) => ({
    key: definition.key,
    rawValue: definition.defaultValue,
    updatedAt: nowTimestampMs(),
    source: 'default' as const,
})

export const bootstrapRuntimeCatalogs = (
    modules: readonly KernelRuntimeModuleV2[],
    dispatchAction: (action: UnknownAction) => UnknownAction,
) => {
    for (const module of modules) {
        module.errorDefinitions?.forEach(definition => {
            dispatchAction(runtimeShellV2StateActions.setErrorCatalogEntry(toCatalogErrorEntry(definition)))
        })
        module.parameterDefinitions?.forEach(definition => {
            dispatchAction(runtimeShellV2StateActions.setParameterCatalogEntry(toCatalogParameterEntry(definition)))
        })
    }
}
