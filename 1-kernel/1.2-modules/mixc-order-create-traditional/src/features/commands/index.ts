import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {Product} from "@impos2/kernel-mixc-product";

export const kernelMixcOrderCreateTraditionalCommands = createModuleCommands(moduleName,{
    addProductOrder:defineCommand<Product>(),
    increaseProductOrderQuantity:defineCommand<{productId:string}>(),
    decreaseProductOrderQuantity:defineCommand<{productId:string}>(),
    removeProductOrder:defineCommand<{productId:string}>(),
    selectProductOrder:defineCommand<{productId:string}>(),
    setProductPrice:defineCommand<{char:string}>(),
    clearProductOrder:defineCommand<void>(),
})

