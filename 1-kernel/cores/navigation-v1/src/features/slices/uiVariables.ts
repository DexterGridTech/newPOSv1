import {
    createWorkspaceSlice,
    DisplayMode, SyncType,
    WorkSpace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection-v1'
import {UiVariablesState} from "../../types/state/uiVariables";
import {kernelCoreNavigationWorkspaceState} from "../../types/shared/moduleStateKey";
import {PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, LOG_TAGS, logger, ScreenPart} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";

const initialState: UiVariablesState = {
    primaryModals: {
        value: [],
        updateAt: 0
    },
    secondaryModals: {
        value: [],
        updateAt: 0
    },
}
const slice = createWorkspaceSlice(
    kernelCoreNavigationWorkspaceState.uiVariables,
    initialState,
    {
        openModal: (state, action: PayloadAction<{ modal: ScreenPart<any>, displayMode: DisplayMode }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'openModal',action.payload)
            const {modal, displayMode} = action.payload;
            if (!modal.id) {
                return;
            }
            const modals = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
            if (modals.value.some(m => m.id === modal.id)) {
                return;
            }
            modals.value.push({
                id: modal.id,
                screenPartKey: modal.partKey,
                props: modal.props,
                open: true,
            });
            modals.updateAt = Date.now();
        },
        closeModal: (state, action: PayloadAction<{ modalId: string, displayMode: DisplayMode }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'closeModal',action.payload)
            const {modalId, displayMode} = action.payload;
            const modals = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
            modals.value = modals.value.filter(m => m.id !== modalId);
        },
        updateUiVariables: (state, action: PayloadAction<Record<string, any>>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'updateUiVariables',action.payload)
            Object.keys(action.payload).forEach(key => {
                state[key] = {value: action.payload[key], updateAt: Date.now()}
            })
        },
        clearUiVariables: (state, action: PayloadAction<string[]>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'clearUiVariables',action.payload)
            action.payload.forEach((key) => {
                state[key] = {value: null, updateAt: Date.now()}
            })
        },
        batchUpdateState: (state, action) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreNavigationWorkspaceState.uiVariables], 'batch update state', action.payload)
        }
    }
)

export const uiVariablesActions = slice.actions

export const uiVariablesSliceConfig: WorkspaceModuleSliceConfig<UiVariablesState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [WorkSpace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [WorkSpace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}