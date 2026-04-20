import {kernelOrderBaseState, kernelOrderBaseUnitDataState} from "./shared/moduleStateKey";
import {OrderState} from "./state";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelOrderBaseState {
    [kernelOrderBaseState.order]:OrderState
}
