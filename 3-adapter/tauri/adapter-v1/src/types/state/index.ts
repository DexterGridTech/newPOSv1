import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType,
} from '@impos2/kernel-core-interconnection'

export interface adapterTauriState {}

export type adapterTauriWorkspaceState = CreateModuleWorkspaceStateType<{}>

export type adapterTauriInstanceState = CreateModuleInstanceModeStateType<{}>
