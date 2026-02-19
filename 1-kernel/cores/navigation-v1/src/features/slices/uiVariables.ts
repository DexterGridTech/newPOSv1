import {
    createWorkspaceSlice,
    DisplayMode, SyncType,
    WorkSpace,
    WorkspaceModuleSliceConfig
} from '@impos2/kernel-core-interconnection-v1'
import {UiVariablesState} from "../../types/state/uiVariables";
import {kernelCoreNavigationState} from "../../types/shared/moduleStateKey";
import {PayloadAction} from "@reduxjs/toolkit";
import {batchUpdateState, kernelCoreBaseState, LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";
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
        openModal: (state, action: PayloadAction<{ model: ScreenPart<any>, displayMode: DisplayMode }>) => {
            const {model, displayMode} = action.payload;
            // 检查 model.id 是否存在
            if (!model.id) {
                return;
            }
            // 检查是否已存在
            const models = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
            if (models.value.some(m => m.id === model.id)) {
                return;
            }

            // 添加新模型
            models.value.push({
                id: model.id,
                screenPartKey: model.partKey,
                props: model.props,
                open: true,
            });
            models.updateAt = Date.now();
        },
        closeModal: (state, action: PayloadAction<{ modelId: string, displayMode: DisplayMode }>) => {
            const {modelId, displayMode} = action.payload;
            const models = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
            models.value = models.value.filter(model => model.id !== modelId);
        },
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
    persistToStorage: true,
    syncType: {
        [WorkSpace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [WorkSpace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
}