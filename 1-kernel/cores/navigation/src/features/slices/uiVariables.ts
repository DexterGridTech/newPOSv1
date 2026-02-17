import {createWorkspaceSlice, WorkspaceModuleSliceConfig} from '@impos2/kernel-core-interconnection'
import {UiVariablesState} from "../../types/state/uiVariables";
import {kernelCoreNavigationState} from "../../types/shared/moduleStateKey";
import {PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, kernelCoreBaseState, LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

const initialState: UiVariablesState = {}
const slice = createWorkspaceSlice(
    kernelCoreNavigationState.uiVariables,
    initialState,
    {
        updateUiVariable: (state, action: PayloadAction<{ [key: string]: any }>) => {
            Object.keys(action.payload).forEach(key => {
                state[key] = {value: action.payload[key], updateAt: Date.now()}
            })
        },
        clearUiVariables: (state, action: PayloadAction<string[]>) => {
            action.payload.forEach((key) => {
                state[key] = {value: null, updateAt: Date.now()}
            })
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreBaseState.errorMessages], 'batch update state', action.payload)
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