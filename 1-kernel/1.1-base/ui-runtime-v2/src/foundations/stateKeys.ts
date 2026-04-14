import {createModuleStateKeys} from '@impos2/kernel-base-state-runtime'
import {moduleName} from '../moduleName'

export const uiRuntimeV2BaseStateKeys = createModuleStateKeys(moduleName, [
    'screen',
    'overlay',
    'ui-variable',
] as const)
