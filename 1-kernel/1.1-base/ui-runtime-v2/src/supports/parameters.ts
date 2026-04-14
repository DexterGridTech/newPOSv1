import {createModuleParameterFactory, integerAtLeast, listDefinitions} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineParameter = createModuleParameterFactory(moduleName)

export const uiRuntimeV2ParameterDefinitions = {
    registryCacheSizeHint: defineParameter.number('registry.cache-size-hint', {
        name: 'UI Runtime V2 Registry Cache Size Hint',
        defaultValue: 256,
        validate: integerAtLeast(1),
    }),
} as const

export const uiRuntimeV2ParameterDefinitionList = listDefinitions(uiRuntimeV2ParameterDefinitions)
