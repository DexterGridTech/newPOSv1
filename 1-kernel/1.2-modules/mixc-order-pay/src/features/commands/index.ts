import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductOrderBase} from "@impos2/kernel-mixc-order-base";

export const kernelMixcOrderPayCommands = createModuleCommands(moduleName,{
    addPayingOrderFromDraft:defineCommand<ProductOrderBase[]>(),
})

