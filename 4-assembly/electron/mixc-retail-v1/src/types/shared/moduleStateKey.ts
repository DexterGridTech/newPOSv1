import {createModuleStateKeys} from '@impos2/kernel-core-base';
import {
  createModuleInstanceModeStateKeys,
  createModuleWorkspaceStateKeys,
} from '@impos2/kernel-core-interconnection';

import {moduleName} from '../../moduleName';

export const assemblyElectronMixcRetailState = createModuleStateKeys(moduleName, [] as const);
export const assemblyElectronMixcRetailInstanceState = createModuleInstanceModeStateKeys(
  moduleName,
  [] as const,
);
export const assemblyElectronMixcRetailWorkspaceState = createModuleWorkspaceStateKeys(
  moduleName,
  [] as const,
);
