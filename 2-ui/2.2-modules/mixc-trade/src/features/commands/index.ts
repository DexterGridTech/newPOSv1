import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const uiMixcTradeCommands = createModuleCommands(moduleName,{
    setOrderCreationTypeToActive: defineCommand<void>(),
    setOrderCreationTypeToPassive: defineCommand<void>(),
})

