import {UserState} from "@impos2/kernel-user-base";
import {UnitDataState} from "@impos2/kernel-core-terminal";
import {kernelProductFromContractState, kernelProductFromContractUnitDataState} from "./shared/moduleStateKey";
import {ContractState} from "./state/contract";

export interface KernelProductFromContractState {
    [kernelProductFromContractState.contract]: ContractState
    [kernelProductFromContractUnitDataState.unitData_contract]: UnitDataState
}
