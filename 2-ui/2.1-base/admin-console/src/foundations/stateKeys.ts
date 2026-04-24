import {createModuleStateKeys} from '@next/kernel-base-state-runtime'
import {moduleName} from '../moduleName'

export const adminConsoleStateKeys = createModuleStateKeys(moduleName, [
    'console',
] as const)
