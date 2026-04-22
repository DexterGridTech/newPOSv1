import { useSelector } from "react-redux";
import { DisplayMode, kernelCoreInterconnectionState } from "@impos2/kernel-core-interconnection";
import { kernelCoreNavigationWorkspaceState } from "../types/shared/moduleStateKey";
const selectUiModels = (state) => {
    const instanceInfo = state[kernelCoreInterconnectionState.instanceInfo];
    const displayMode = instanceInfo?.displayMode;
    const workspace = instanceInfo?.workspace;
    const uiVariables = state[`${kernelCoreNavigationWorkspaceState.uiVariables}.${workspace}`];
    return displayMode === DisplayMode.PRIMARY ? uiVariables?.primaryModals?.value : uiVariables?.secondaryModals?.value;
};
export const useUiModels = () => {
    return useSelector((state) => selectUiModels(state));
};
