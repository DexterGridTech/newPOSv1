import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const uiCoreBaseCommands = createModuleCommands(moduleName,{
    screenLongPressed: defineCommand<void>(),
})

