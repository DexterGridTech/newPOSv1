import {UserState} from "./state";
import {kernelMixcUserLoginState, kernelMixcUserLoginUnitDataState} from "./shared/moduleStateKey";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelMixcUserLoginState {
    [kernelMixcUserLoginState.user]: UserState
    [kernelMixcUserLoginUnitDataState.unitData_user]: UnitDataState
}
