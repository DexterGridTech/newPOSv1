import {
    batchUpdateState,
    LOG_TAGS,
    logger,
    PERSIST_KEY
} from "@impos2/kernel-core-base";
import {
    createWorkspaceSlice,
    SyncType,
    Workspace,
    WorkspaceModuleSliceConfig
} from "@impos2/kernel-core-interconnection";
import {PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {UiVariablesState} from "../../types/state";
import {kernelCoreUiRuntimeWorkspaceState} from "../../types/shared/moduleStateKey";

const initialState: UiVariablesState = {}

const slice = createWorkspaceSlice(
    kernelCoreUiRuntimeWorkspaceState.uiVariables,
    initialState,
    {
        updateUiVariables: (state, action: PayloadAction<Record<string, any>>) => {
            Object.keys(action.payload).forEach(key => {
                if (key === PERSIST_KEY) return
                logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], `Setting ${key}:`, action.payload[key])
                state[key] = {value: action.payload[key], updatedAt: Date.now()}
            })
        },
        clearUiVariables: (state, action: PayloadAction<string[]>) => {
            action.payload.forEach((key) => {
                if (key === PERSIST_KEY) return
                state[key] = {value: null, updatedAt: Date.now()}
            })
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
        }
    }
)

export const uiVariableActions = slice.actions

export const uiVariablesSliceConfig: WorkspaceModuleSliceConfig<UiVariablesState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}
