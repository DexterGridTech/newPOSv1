import {createModuleCommands, defineCommand, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {Contract} from "../../types";

export const kernelProductFromContractCommands = createModuleCommands(moduleName,{
    updateContracts: defineCommand<Record<string, ValueWithUpdatedAt<Contract> | undefined | null>>(),
})

