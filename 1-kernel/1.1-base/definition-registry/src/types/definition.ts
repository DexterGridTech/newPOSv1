import type {ErrorDefinition, ParameterDefinition} from '@next/kernel-base-contracts'

export interface KeyedDefinition {
    key: string
    name: string
    moduleName?: string
}
