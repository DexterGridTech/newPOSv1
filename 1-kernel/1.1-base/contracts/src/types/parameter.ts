import type {TimestampMs} from './ids'

export type ParameterValueType = 'string' | 'number' | 'boolean' | 'json'

export interface ParameterDefinition<TValue = unknown> {
    key: string
    name: string
    defaultValue: TValue
    valueType: ParameterValueType
    moduleName?: string
    decode?: (raw: unknown) => TValue
    validate?: (value: TValue) => boolean
}

export interface ParameterCatalogEntry {
    key: string
    rawValue: unknown
    updatedAt: TimestampMs
    source: 'default' | 'remote' | 'host'
}

export interface ResolvedParameter<TValue = unknown> {
    key: string
    value: TValue
    source: 'default' | 'catalog-fallback' | 'catalog'
    valid: boolean
}
