import type {ErrorDefinition, ParameterDefinition} from '@next/kernel-base-contracts'
import type {KeyedDefinition} from '../types/definition'
import type {DefinitionRegistry, DefinitionRegistryBundle} from '../types/registry'

export const createKeyedDefinitionRegistry = <TDefinition extends KeyedDefinition>(
    kind: string,
): DefinitionRegistry<TDefinition> => {
    const definitions = new Map<string, TDefinition>()
    const registerDefinition = (definition: TDefinition) => {
        if (definitions.has(definition.key)) {
            throw new Error(`[${kind}] duplicated definition key: ${definition.key}`)
        }

        definitions.set(definition.key, definition)
        return definition
    }

    return {
        kind,
        register(definition) {
            return registerDefinition(definition)
        },
        registerMany(input) {
            input.forEach(definition => {
                registerDefinition(definition)
            })
            return input
        },
        has(key) {
            return definitions.has(key)
        },
        get(key) {
            return definitions.get(key)
        },
        getOrThrow(key) {
            const definition = definitions.get(key)
            if (!definition) {
                throw new Error(`[${kind}] definition not found: ${key}`)
            }
            return definition
        },
        list() {
            return [...definitions.values()]
        },
        snapshot() {
            return Object.freeze(Object.fromEntries(definitions.entries()))
        },
    }
}

export const createDefinitionRegistryBundle = (): DefinitionRegistryBundle => {
    return {
        errors: createKeyedDefinitionRegistry<ErrorDefinition>('error-definition'),
        parameters: createKeyedDefinitionRegistry<ParameterDefinition>('parameter-definition'),
    }
}
