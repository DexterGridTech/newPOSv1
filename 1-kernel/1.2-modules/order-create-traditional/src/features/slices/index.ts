import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {createOrderSliceConfig} from "./createOrder";


export const kernelOrderCreateTraditionalSlice = {
    ...toModuleSliceConfigs(createOrderSliceConfig),
}