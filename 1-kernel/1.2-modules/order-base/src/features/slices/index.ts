import {orderConfig} from "./order";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelOrderBaseUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelOrderBaseSlice = {
    orderState: orderConfig,
    [kernelOrderBaseUnitDataState.unitData_order]:
        generateUnitDataSliceConfig(kernelOrderBaseUnitDataState.unitData_order),
}