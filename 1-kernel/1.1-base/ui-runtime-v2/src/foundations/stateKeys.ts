import {createModuleStateKeys} from '@next/kernel-base-state-runtime'
import {moduleName} from '../moduleName'

export const uiRuntimeV2BaseStateKeys = createModuleStateKeys(moduleName, [
    'screen',
    'overlay',
    'ui-variable',
] as const)
