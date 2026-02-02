import {uiVariablesSlice} from "./uiVariables";
import {uiModalsSlice} from "./uiModals";

export * from './uiVariables';
export * from './uiModals';

export const uiNavigationModuleReducers = {
    [uiVariablesSlice.name]: uiVariablesSlice.reducer,
    [uiModalsSlice.name]: uiModalsSlice.reducer,
};
