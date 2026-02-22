import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const uiAdminCommands = createModuleCommands(moduleName,{
    adminLogin: defineCommand<{adminPassword: string}>(),
})

