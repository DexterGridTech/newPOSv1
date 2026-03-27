import { moduleName } from '../../moduleName'
import { createModuleStateKeys } from '@impos2/kernel-core-base'
import {
    createModuleInstanceModeStateKeys,
    createModuleWorkspaceStateKeys,
} from '@impos2/kernel-core-interconnection'

export const adapterTauriState = createModuleStateKeys(moduleName, [] as const)

export const adapterTauriInstanceState = createModuleInstanceModeStateKeys(moduleName, [] as const)

export const adapterTauriWorkspaceState = createModuleWorkspaceStateKeys(moduleName, [] as const)
