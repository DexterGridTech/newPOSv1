import {contractConfig} from "./contract";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelMixcProductUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelMixcProductSlice = {
    contractState: contractConfig,
    [kernelMixcProductUnitDataState.unitData_contract]:
        generateUnitDataSliceConfig(kernelMixcProductUnitDataState.unitData_contract),
}