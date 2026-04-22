import { createModuleCommands, defineCommand } from "@impos2/kernel-core-base";
import { moduleName } from "../../moduleName";
export const kernelCoreNavigationCommands = createModuleCommands(moduleName, {
    navigateTo: defineCommand(),
    openModal: defineCommand(),
    closeModal: defineCommand(),
    setUiVariables: defineCommand(),
    clearUiVariables: defineCommand(),
});
