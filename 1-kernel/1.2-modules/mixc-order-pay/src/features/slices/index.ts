import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {payingOrderSliceConfig} from "./payingOrder";


export const kernelMixcOrderPaySlice = {
    ...toModuleSliceConfigs(payingOrderSliceConfig),
}