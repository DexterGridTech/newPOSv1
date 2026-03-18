import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductBase} from "@impos2/kernel-product-base";

export const kernelOrderCreateTraditionalCommands = createModuleCommands(moduleName,{
    addProductOrder:defineCommand<ProductBase>(),
    increaseProductOrderQuantity:defineCommand<{productId:string}>(),
    decreaseProductOrderQuantity:defineCommand<{productId:string}>(),
    removeProductOrder:defineCommand<{productId:string}>(),
    selectProductOrder:defineCommand<{productId:string}>(),
    setProductPrice:defineCommand<{char:string}>(),
    clearProductOrder:defineCommand<void>(),
})

