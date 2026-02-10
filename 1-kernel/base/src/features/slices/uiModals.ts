import {ModalScreen, ScreenPart} from "../../types/core/screen";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {InstanceMode} from "../../types/core";
import {registerStateToPersist, registerStateToSync} from "../../core/store";
import {KernelBaseStateNames} from "../../types/stateNames";
import {UiModalsState} from "../../types/state";

export type {UiModalsState}

const initialState: UiModalsState = {
    master: [],
    slave: []
}

export const uiModalsSlice = createSlice({
    name: KernelBaseStateNames.uiModals,
    initialState,
    reducers: {
        openModal: (state, action: PayloadAction<{ model: ScreenPart, instanceMode: InstanceMode }>) => {
            const { model, instanceMode } = action.payload;

            // 检查 model.id 是否存在
            if (!model.id) {
                return;
            }

            // 检查是否已存在
            const models = state[instanceMode];
            if (models.some(m => m.id === model.id)) {
                return;
            }

            // 添加新模型
            models.push({
                id: model.id,
                partKey: model.partKey,
                props: model.props,
                open: true,
            });
        },
        closeModal: (state, action: PayloadAction<{ modelId: string, instanceMode: InstanceMode }>) => {
            const { modelId, instanceMode } = action.payload;
            const models = state[instanceMode];
            state[instanceMode] = models.filter(model => model.id !== modelId);
        }
    }
})

export const uiModelsActions = uiModalsSlice.actions

registerStateToSync(KernelBaseStateNames.uiModals)
registerStateToPersist(KernelBaseStateNames.uiModals)
