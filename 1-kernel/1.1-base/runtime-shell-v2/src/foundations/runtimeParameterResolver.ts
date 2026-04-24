import {resolveParameter as resolveDefinitionParameter} from '@next/kernel-base-definition-registry'
import type {
    ParameterCatalogEntry,
    ParameterDefinition,
    ResolvedParameter,
} from '@next/kernel-base-contracts'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY} from '../features/slices/parameterCatalogState'

export const createRuntimeParameterResolver = (store: EnhancedStore) => {
    /**
     * 设计意图：
     * runtime-shell-v2 只负责读取运行时 catalog；默认值、校验和 source 归 definition-registry 统一解析。
     * 这样 system.parameter topic 下发后只需要更新 catalog state，所有包的 resolveParameter 语义保持一致。
     */
    return <TValue>(resolveInput: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue> => {
        const state = store.getState() as Record<string, unknown>
        const catalog = state[RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY] as
            | Record<string, ParameterCatalogEntry>
            | undefined
        const catalogEntry = catalog?.[resolveInput.key]
        const definition = resolveInput.definition

        if (definition) {
            return resolveDefinitionParameter({
                definition,
                parameterCatalog: catalog,
            })
        }

        if (catalogEntry) {
            return {
                key: resolveInput.key,
                value: catalogEntry.rawValue as TValue,
                source: 'catalog',
                valid: true,
            }
        }

        return {
            key: resolveInput.key,
            value: undefined as TValue,
            source: 'default',
            valid: false,
        }
    }
}
