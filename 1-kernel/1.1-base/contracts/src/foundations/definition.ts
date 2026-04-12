import type {
    ErrorCategory,
    ErrorDefinition,
    ErrorSeverity,
    ParameterDefinition,
    ParameterValueType,
} from '../types'

export interface DefineErrorInput {
    name: string
    defaultTemplate: string
    category: ErrorCategory
    severity: ErrorSeverity
    code?: string
}

export interface DefineParameterInput<TValue> {
    name: string
    defaultValue: TValue
    decode?: (raw: unknown) => TValue
    validate?: (value: TValue) => boolean
}

const createDefinitionKey = (
    moduleName: string,
    localKey: string,
) => `${moduleName}.${localKey}`

export const createModuleErrorFactory = (moduleName: string) => {
    return (
        localKey: string,
        input: DefineErrorInput,
    ): ErrorDefinition => ({
        key: createDefinitionKey(moduleName, localKey),
        name: input.name,
        defaultTemplate: input.defaultTemplate,
        category: input.category,
        severity: input.severity,
        code: input.code,
        moduleName,
    })
}

const createParameterDefinition = <TValue>(
    moduleName: string,
    localKey: string,
    valueType: ParameterValueType,
    input: DefineParameterInput<TValue>,
): ParameterDefinition<TValue> => ({
    key: createDefinitionKey(moduleName, localKey),
    name: input.name,
    defaultValue: input.defaultValue,
    valueType,
    moduleName,
    decode: input.decode,
    validate: input.validate,
})

export const createModuleParameterFactory = (moduleName: string) => ({
    string: (
        localKey: string,
        input: DefineParameterInput<string>,
    ): ParameterDefinition<string> => createParameterDefinition(moduleName, localKey, 'string', input),
    number: (
        localKey: string,
        input: DefineParameterInput<number>,
    ): ParameterDefinition<number> => createParameterDefinition(moduleName, localKey, 'number', input),
    boolean: (
        localKey: string,
        input: DefineParameterInput<boolean>,
    ): ParameterDefinition<boolean> => createParameterDefinition(moduleName, localKey, 'boolean', input),
    json: <TValue>(
        localKey: string,
        input: DefineParameterInput<TValue>,
    ): ParameterDefinition<TValue> => createParameterDefinition(moduleName, localKey, 'json', input),
})

export const listDefinitions = <TDefinition extends Record<string, unknown>>(
    definitions: TDefinition,
): readonly TDefinition[keyof TDefinition][] => Object.values(definitions) as TDefinition[keyof TDefinition][]
