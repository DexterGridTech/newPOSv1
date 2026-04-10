import type {ErrorDefinition, ParameterDefinition} from '@impos2/kernel-base-contracts'
import type {KeyedDefinition} from './definition'

export interface DefinitionRegistry<TDefinition extends KeyedDefinition> {
    readonly kind: string
    register(definition: TDefinition): TDefinition
    registerMany(definitions: readonly TDefinition[]): readonly TDefinition[]
    has(key: string): boolean
    get(key: string): TDefinition | undefined
    getOrThrow(key: string): TDefinition
    list(): readonly TDefinition[]
    snapshot(): Readonly<Record<string, TDefinition>>
}

export interface DefinitionRegistryBundle {
    errors: DefinitionRegistry<ErrorDefinition>
    parameters: DefinitionRegistry<ParameterDefinition>
}
