import {UserState} from "./state";
import {kernelUserBaseState, kernelUserBaseUnitDataState} from "./shared/moduleStateKey";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelUserBaseState {
    [kernelUserBaseState.user]: UserState
    [kernelUserBaseUnitDataState.unitData_user]: UnitDataState
}
