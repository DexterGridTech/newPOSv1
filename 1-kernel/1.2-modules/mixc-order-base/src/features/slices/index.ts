import {orderConfig} from "./order";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelMixcOrderBaseUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelMixcOrderBaseSlice = {
    orderState: orderConfig,
    [kernelMixcOrderBaseUnitDataState.unitData_order]:
        generateUnitDataSliceConfig(kernelMixcOrderBaseUnitDataState.unitData_order),
}