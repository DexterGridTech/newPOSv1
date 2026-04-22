import { createModuleCommands, defineCommand } from "../../foundations";
import { moduleName } from "../../moduleName";
export const kernelCoreBaseCommands = createModuleCommands(moduleName, {
    initialize: defineCommand(),
    updateErrorMessages: defineCommand(),
    updateSystemParameters: defineCommand(),
    clearDataCache: defineCommand(),
    switchServerSpace: defineCommand(),
});
