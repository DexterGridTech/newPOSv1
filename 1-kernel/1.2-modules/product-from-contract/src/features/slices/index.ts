import {contractConfig} from "./contract";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelProductFromContractUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelProductFromContractSlice = {
    contractState: contractConfig,
    [kernelProductFromContractUnitDataState.unitData_contract]:
        generateUnitDataSliceConfig(kernelProductFromContractUnitDataState.unitData_contract),
}