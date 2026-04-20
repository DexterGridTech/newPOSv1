import type {ErrorDefinition, ParameterDefinition} from '@impos2/kernel-base-contracts'

export interface KeyedDefinition {
    key: string
    name: string
    moduleName?: string
}
