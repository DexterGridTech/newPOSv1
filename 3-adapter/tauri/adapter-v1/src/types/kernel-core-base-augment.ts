import {
    adapterTauriState,
    adapterTauriWorkspaceState,
    adapterTauriInstanceState,
} from './state'

declare module '@impos2/kernel-core-base' {
    export interface RootState
        extends adapterTauriState,
            adapterTauriWorkspaceState,
            adapterTauriInstanceState {}
}
