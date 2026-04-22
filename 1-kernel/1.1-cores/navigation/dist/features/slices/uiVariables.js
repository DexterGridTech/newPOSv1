import { createWorkspaceSlice, DisplayMode, SyncType, Workspace } from '@impos2/kernel-core-interconnection';
import { kernelCoreNavigationWorkspaceState } from "../../types/shared/moduleStateKey";
import { batchUpdateState, LOG_TAGS, logger, PERSIST_KEY } from "@impos2/kernel-core-base";
import { moduleName } from "../../moduleName";
const initialState = {
    primaryModals: {
        value: [],
        updatedAt: 0
    },
    secondaryModals: {
        value: [],
        updatedAt: 0
    },
};
const slice = createWorkspaceSlice(kernelCoreNavigationWorkspaceState.uiVariables, initialState, {
    openModal: (state, action) => {
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'openModal',action.payload)
        const { modal, displayMode } = action.payload;
        if (!modal.id) {
            logger.error([moduleName, LOG_TAGS.Reducer, "uiVariables"], `openModal , modals id is null `, action.payload);
            return;
        }
        let modals = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
        if (!modals) {
            logger.error([moduleName, LOG_TAGS.Reducer, "uiVariables"], `openModal , modals is null primaryModals:${state.primaryModals},secondaryModals:${state.secondaryModals}`, action.payload);
            return;
        }
        if (modals.value.some(m => m.id === modal.id)) {
            logger.error([moduleName, LOG_TAGS.Reducer, "uiVariables"], `openModal , modals id existed `, action.payload);
            return;
        }
        modals.value.push({
            id: modal.id,
            screenPartKey: modal.partKey,
            props: modal.props,
            open: true,
        });
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], '------》openModal after',modals)
        modals.updatedAt = Date.now();
    },
    closeModal: (state, action) => {
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], '-----------------------》closeModal',action.payload)
        const { modalId, displayMode } = action.payload;
        const modals = displayMode === DisplayMode.PRIMARY ? state.primaryModals : state.secondaryModals;
        modals.value = modals.value.filter(m => m.id !== modalId);
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], '=======================》closeModal',modals.value)
        modals.updatedAt = Date.now();
    },
    updateUiVariables: (state, action) => {
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'updateUiVariables',action.payload)
        Object.keys(action.payload).forEach(key => {
            if (key === PERSIST_KEY)
                return;
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], `Setting ${key}:`, action.payload[key]);
            state[key] = { value: action.payload[key], updatedAt: Date.now() };
            logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], `After setting, state[${key}]:`, state[key]);
        });
    },
    clearUiVariables: (state, action) => {
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'clearUiVariables',action.payload)
        action.payload.forEach((key) => {
            if (key === PERSIST_KEY)
                return;
            state[key] = { value: null, updatedAt: Date.now() };
        });
    },
    batchUpdateState: (state, action) => {
        // logger.log([moduleName, LOG_TAGS.Reducer, "uiVariables"], 'batchUpdateState',action.payload)
        batchUpdateState(state, action);
    }
});
export const uiVariablesActions = slice.actions;
export const uiVariablesSliceConfig = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: true,
    syncType: {
        [Workspace.MAIN]: SyncType.MASTER_TO_SLAVE,
        [Workspace.BRANCH]: SyncType.SLAVE_TO_MASTER
    }
};
