import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreTaskCommands = createModuleCommands(moduleName,{
    open:defineCommand<{key:string}>(),
    take:defineCommand<{ bagId: string}>(),
    close:defineCommand<void>(),
})

