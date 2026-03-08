import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const uiCoreAdminCommands = createModuleCommands(moduleName,{
    adminLogin: defineCommand<{adminPassword: string}>(),
})

