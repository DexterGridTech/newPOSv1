import type {
  assemblyElectronMixcRetailInstanceState,
  assemblyElectronMixcRetailState,
  assemblyElectronMixcRetailWorkspaceState,
} from './moduleState';

declare module '@impos2/kernel-core-base' {
  export interface RootState
    extends assemblyElectronMixcRetailState,
      assemblyElectronMixcRetailWorkspaceState,
      assemblyElectronMixcRetailInstanceState {}
}
