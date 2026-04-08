import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const uiCoreRuntimeBaseCommands = createModuleCommands(moduleName, {
    screenLongPressed: defineCommand<void>(),
})
