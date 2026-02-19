import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base-v1";
import {DisplayMode, getDisplayMode, getWorkspaceState} from "@impos2/kernel-core-interconnection-v1";
import {kernelCoreNavigationState} from "../types/shared/moduleStateKey";
import {UiVariablesState} from "../types/state/uiVariables";

const selectUiModels = (state: RootState) => {
    const displayMode = getDisplayMode()
    const uiVariables = getWorkspaceState(kernelCoreNavigationState.uiVariables) as UiVariablesState
    return displayMode === DisplayMode.PRIMARY ? uiVariables.primaryModals.value : uiVariables.secondaryModals.value
};

export const useUiModels = () => {
    return useSelector((state: RootState) => selectUiModels(state))
}
