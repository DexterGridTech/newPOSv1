import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductOrderBase} from "@impos2/kernel-order-base";

export const kernelPayBaseCommands = createModuleCommands(moduleName,{
    addPayingOrderFromDraft:defineCommand<ProductOrderBase[]>(),
})

