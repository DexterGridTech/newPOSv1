import { kernelCoreInterconnectionState } from "../../types/shared/moduleStateKey";
export const selectDisplayMode = (state) => state[kernelCoreInterconnectionState.instanceInfo].displayMode;
