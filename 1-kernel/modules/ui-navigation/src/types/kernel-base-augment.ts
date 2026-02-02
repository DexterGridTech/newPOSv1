import '@impos2/kernel-base';
import {uiModalsSlice, UiModelsState, uiVariablesSlice, UiVariablesState} from "../features";

declare module '@impos2/kernel-base' {
    interface RootState {
        [uiVariablesSlice.name]: UiVariablesState;
        [uiModalsSlice.name]: UiModelsState;
    }
}
