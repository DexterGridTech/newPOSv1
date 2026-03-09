import {RootState} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";

export const selectDisplayMode = (state: RootState) =>
    state[kernelCoreInterconnectionState.instanceInfo].displayMode;
