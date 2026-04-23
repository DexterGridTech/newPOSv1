import {renderErrorTemplate} from '@impos2/kernel-base-contracts'
import type {
    AppError,
    ErrorCatalogEntry,
    ErrorDefinition,
    ParameterCatalogEntry,
    ParameterDefinition,
    ResolvedErrorView,
    ResolvedParameter,
} from '@impos2/kernel-base-contracts'
import type {DefinitionRegistryBundle} from '../types/registry'

/**
 * 设计意图：
 * 这里是错误与参数解析的唯一规则入口。
 * runtime-shell、业务模块和测试都应该复用这里的 decode/validate/fallback 语义，避免各处各自维护一套“看起来差不多”的解析逻辑。
 */
export interface ResolveAppErrorInput {
    appError: AppError
    definitionRegistry?: DefinitionRegistryBundle['errors']
    errorCatalog?: Readonly<Record<string, ErrorCatalogEntry>>
}

export const resolveAppError = (
    input: ResolveAppErrorInput,
): ResolvedErrorView => {
    const definition = input.definitionRegistry?.get(input.appError.key)
    const catalogEntry = input.errorCatalog?.[input.appError.key]
    const template = catalogEntry?.template ?? definition?.defaultTemplate

    if (template) {
        return {
            key: input.appError.key,
            code: input.appError.code,
            name: definition?.name ?? input.appError.name,
            category: definition?.category ?? input.appError.category,
            severity: definition?.severity ?? input.appError.severity,
            template,
            message: renderErrorTemplate(template, input.appError.args),
            source: catalogEntry ? 'catalog' : 'definition-default',
        }
    }

    return {
        key: input.appError.key,
        code: input.appError.code,
        name: input.appError.name,
        category: input.appError.category,
        severity: input.appError.severity,
        template: input.appError.message,
        message: input.appError.message,
        source: 'app-error',
    }
}

export interface ResolveParameterInput<TValue = unknown> {
    definition: ParameterDefinition<TValue>
    parameterCatalog?: Readonly<Record<string, ParameterCatalogEntry>>
}

const decodeBooleanParameterValue = (rawValue: unknown): boolean => {
    if (rawValue === true || rawValue === 1) {
        return true
    }
    if (rawValue === false || rawValue === 0) {
        return false
    }
    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase()
        if (normalized === 'true' || normalized === '1') {
            return true
        }
        if (normalized === 'false' || normalized === '0') {
            return false
        }
    }
    throw new Error(`Invalid boolean rawValue: ${String(rawValue)}`)
}

const decodeParameterValue = <TValue>(
    definition: ParameterDefinition<TValue>,
    rawValue: unknown,
) => {
    if (definition.decode) {
        return definition.decode(rawValue)
    }

    if (definition.valueType === 'number') {
        const decoded = Number(rawValue)
        if (Number.isNaN(decoded)) {
            throw new Error(`Invalid number rawValue: ${String(rawValue)}`)
        }
        return decoded as TValue
    }

    if (definition.valueType === 'boolean') {
        return decodeBooleanParameterValue(rawValue) as TValue
    }

    if (definition.valueType === 'json') {
        return (typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue) as TValue
    }

    return String(rawValue) as TValue
}

export const resolveParameter = <TValue = unknown>(
    input: ResolveParameterInput<TValue>,
): ResolvedParameter<TValue> => {
    const catalogEntry = input.parameterCatalog?.[input.definition.key]
    if (!catalogEntry) {
        return {
            key: input.definition.key,
            value: input.definition.defaultValue,
            source: 'default',
            valid: true,
        }
    }

    try {
        const decodedValue = decodeParameterValue(input.definition, catalogEntry.rawValue)
        const valid = input.definition.validate?.(decodedValue) ?? true

        if (!valid) {
            return {
                key: input.definition.key,
                value: input.definition.defaultValue,
                source: 'catalog-fallback',
                valid: false,
            }
        }

        return {
            key: input.definition.key,
            value: decodedValue,
            source: 'catalog',
            valid: true,
        }
    } catch (_error) {
        return {
            key: input.definition.key,
            value: input.definition.defaultValue,
            source: 'catalog-fallback',
            valid: false,
        }
    }
}

export interface ResolveParameterByKeyInput<TValue = unknown> {
    key: string
    parameterRegistry: DefinitionRegistryBundle['parameters']
    parameterCatalog?: Readonly<Record<string, ParameterCatalogEntry>>
}

export const resolveParameterByKey = <TValue = unknown>(
    input: ResolveParameterByKeyInput<TValue>,
): ResolvedParameter<TValue> => {
    const definition = input.parameterRegistry.getOrThrow(input.key) as ParameterDefinition<TValue>
    return resolveParameter({
        definition,
        parameterCatalog: input.parameterCatalog,
    })
}

export interface ResolveErrorDefinitionByKeyInput {
    key: string
    errorRegistry: DefinitionRegistryBundle['errors']
    errorCatalog?: Readonly<Record<string, ErrorCatalogEntry>>
    appError?: AppError
}

export const resolveErrorDefinitionByKey = (
    input: ResolveErrorDefinitionByKeyInput,
): ResolvedErrorView => {
    const definition = input.errorRegistry.get(input.key)
    if (input.appError) {
        if (input.appError.key !== input.key) {
            throw new Error(`[resolveErrorDefinitionByKey] appError.key mismatch: ${input.key} !== ${input.appError.key}`)
        }
        return resolveAppError({
            appError: input.appError,
            definitionRegistry: input.errorRegistry,
            errorCatalog: input.errorCatalog,
        })
    }

    if (!definition) {
        throw new Error(`[resolveErrorDefinitionByKey] definition not found: ${input.key}`)
    }

    const catalogEntry = input.errorCatalog?.[input.key]
    const template = catalogEntry?.template ?? definition.defaultTemplate

    return {
        key: definition.key,
        code: definition.code ?? definition.key,
        name: definition.name,
        category: definition.category,
        severity: definition.severity,
        template,
        message: renderErrorTemplate(template),
        source: catalogEntry ? 'catalog' : 'definition-default',
    }
}

export interface CatalogSnapshots {
    readonly errorCatalog?: Readonly<Record<string, ErrorCatalogEntry>>
    readonly parameterCatalog?: Readonly<Record<string, ParameterCatalogEntry>>
}

export interface DefinitionResolverBundle {
    resolveAppError(input: Omit<ResolveAppErrorInput, 'definitionRegistry' | 'errorCatalog'>): ResolvedErrorView
    resolveErrorByKey(input: Omit<ResolveErrorDefinitionByKeyInput, 'errorRegistry' | 'errorCatalog'>): ResolvedErrorView
    resolveParameter<TValue = unknown>(input: Omit<ResolveParameterInput<TValue>, 'parameterCatalog'>): ResolvedParameter<TValue>
    resolveParameterByKey<TValue = unknown>(key: string): ResolvedParameter<TValue>
}

export const createDefinitionResolverBundle = (
    registries: DefinitionRegistryBundle,
    snapshots: CatalogSnapshots = {},
): DefinitionResolverBundle => {
    return {
        resolveAppError(input) {
            return resolveAppError({
                ...input,
                definitionRegistry: registries.errors,
                errorCatalog: snapshots.errorCatalog,
            })
        },
        resolveErrorByKey(input) {
            return resolveErrorDefinitionByKey({
                ...input,
                errorRegistry: registries.errors,
                errorCatalog: snapshots.errorCatalog,
            })
        },
        resolveParameter(input) {
            return resolveParameter({
                ...input,
                parameterCatalog: snapshots.parameterCatalog,
            })
        },
        resolveParameterByKey(key) {
            return resolveParameterByKey({
                key,
                parameterRegistry: registries.parameters,
                parameterCatalog: snapshots.parameterCatalog,
            })
        },
    }
}
