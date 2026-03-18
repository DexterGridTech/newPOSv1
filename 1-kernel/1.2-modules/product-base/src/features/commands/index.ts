import {createModuleCommands, defineCommand, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {ProductBase} from "../../types";

export const kernelProductBaseCommands = createModuleCommands(moduleName, {
    updateProduct: defineCommand<Record<string, ValueWithUpdatedAt<ProductBase> | undefined | null>>(),
})

