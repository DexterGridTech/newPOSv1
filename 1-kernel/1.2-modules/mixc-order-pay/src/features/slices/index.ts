import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {payingOrderSliceConfig} from "./payingOrder";
import {paymentFunctionConfig} from "./paymentFunction";


export const kernelMixcOrderPaySlice = {
    ...toModuleSliceConfigs(payingOrderSliceConfig),
    paymentFunction:paymentFunctionConfig
}