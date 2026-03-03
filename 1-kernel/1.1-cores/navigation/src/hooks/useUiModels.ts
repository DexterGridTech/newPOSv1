import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {DisplayMode, kernelCoreInterconnectionState, Workspace} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationWorkspaceState} from "../types/shared/moduleStateKey";
import {UiVariablesState} from "../types/state/uiVariables";

const selectUiModels = (state: RootState) => {
    const instanceInfo = (state as any)[kernelCoreInterconnectionState.instanceInfo]
    const displayMode: DisplayMode = instanceInfo?.displayMode
    const workspace: Workspace = instanceInfo?.workspace
    const uiVariables = (state as any)[`${kernelCoreNavigationWorkspaceState.uiVariables}.${workspace}`] as UiVariablesState
    return displayMode === DisplayMode.PRIMARY ? uiVariables?.primaryModals?.value : uiVariables?.secondaryModals?.value
};

export const useUiModels = () => {
    return useSelector((state: RootState) => selectUiModels(state))
}
