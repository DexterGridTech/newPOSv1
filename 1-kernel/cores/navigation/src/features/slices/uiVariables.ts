import {createWorkspaceSlice, WorkspaceModuleSliceConfig} from '@impos2/kernel-core-interconnection'
import {UiVariablesState} from "../../types/state/uiVariables";
import {kernelCoreNavigationState} from "../../types/shared/moduleStateKey";
import {PayloadAction} from "@reduxjs/toolkit";

const initialState: UiVariablesState = {}
const slice = createWorkspaceSlice(
    kernelCoreNavigationState.uiVariables,
    initialState,
    {
        updateUiVariable: (state, action: PayloadAction<{ [key: string]: any }>) => {
            Object.keys(action.payload).forEach(key => {
                state[key] = action.payload[key];
            })
        },
        clearUiVariables: (state, action: PayloadAction<string[]>) => {
            action.payload.forEach((key) => {
                delete state[key]
            })
        }
    }
)

export const uiVariablesActions = slice.actions

export const uiVariablesSliceConfig: WorkspaceModuleSliceConfig<UiVariablesState> = {
    name: slice.name,
    reducers: slice.reducers,
    statePersistToStorage: true,
    stateSyncToSlave: true
}