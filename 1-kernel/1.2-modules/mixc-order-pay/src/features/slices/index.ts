import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {payingOrderSliceConfig} from "./payingOrder";
import {paymentFunctionConfig} from "./paymentFunction";
import {generateUnitDataSliceConfig} from "@impos2/kernel-core-terminal";
import {kernelMixcOrderPayUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelMixcOrderPaySlice = {
    ...toModuleSliceConfigs(payingOrderSliceConfig),
    paymentFunction:paymentFunctionConfig,
    [kernelMixcOrderPayUnitDataState.unitData_paymentFunction]:
        generateUnitDataSliceConfig(kernelMixcOrderPayUnitDataState.unitData_paymentFunction),
}