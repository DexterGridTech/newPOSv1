import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {Product} from "@impos2/kernel-mixc-product";

export const kernelMixcOrderCreateTraditionalCommands = createModuleCommands(moduleName,{
    addProductOrder:defineCommand<Product>(),
})

