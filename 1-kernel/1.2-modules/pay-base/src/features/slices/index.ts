import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {payingOrderSliceConfig} from "./payingOrder";
import {paymentFunctionConfig} from "./paymentFunction";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelPayBaseUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelPayBaseSlice = {
    ...toModuleSliceConfigs(payingOrderSliceConfig),
    paymentFunction:paymentFunctionConfig,
    [kernelPayBaseUnitDataState.unitData_paymentFunction]:
        generateUnitDataSliceConfig(kernelPayBaseUnitDataState.unitData_paymentFunction),
}