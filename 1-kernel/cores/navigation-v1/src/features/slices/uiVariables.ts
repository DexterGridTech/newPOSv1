import {
    createWorkspaceSlice,
    DisplayMode, SyncType,
    WorkSpace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection-v1'
import {UiVariablesState} from "../../types/state/uiVariables";
import {kernelCoreNavigationState} from "../../types/shared/moduleStateKey";
import {PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";
import {ScreenPart} from "../../types/foundations/screen";

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
    kernelCoreNavigationState.uiVariables,
    initialState,
    {
        openModal: (state, action: PayloadAction<{ modal: ScreenPart<any>, displayMode: DisplayMode }>) => {
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
            const {modalId, displayMode} = action.payload;
            const modals = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
            modals.value = modals.value.filter(m => m.id !== modalId);
        },
        updateUiVariables: (state, action: PayloadAction<Record<string, any>>) => {
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
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreNavigationState.uiVariables], 'batch update state', action.payload)
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