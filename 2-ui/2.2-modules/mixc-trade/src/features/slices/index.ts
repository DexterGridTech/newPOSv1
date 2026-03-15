import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {orderCreationSliceConfig} from "./orderCreation";


export const uiMixcTradeSlice = {
    ...toModuleSliceConfigs(orderCreationSliceConfig),
}