import {ModalScreen, ScreenPart} from "../../types/core/screen";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {InstanceMode} from "../../types/core";
import {registerStateToPersist, registerStateToSync} from "../../core/store";


export interface UiModalsState {
    master: ModalScreen<any>[]
    slave: ModalScreen<any>[]
}

const initialState: UiModalsState = {
    master: [],
    slave: []
}

export const uiModalsSlice = createSlice({
    name: 'uiModals',
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

            // 清理已关闭的模型（垃圾回收）
            state[instanceMode] = models.filter(m => m.open);
        },
        closeModal: (state, action: PayloadAction<{ modelId: string, instanceMode: InstanceMode }>) => {
            const models = state[action.payload.instanceMode]
            const find = models.find(model => model.id === action.payload.modelId)
            if (find)
                find.open = false
        }
    }
})

export const uiModelsActions = uiModalsSlice.actions

registerStateToSync(uiModalsSlice.name)
registerStateToPersist(uiModalsSlice.name)
