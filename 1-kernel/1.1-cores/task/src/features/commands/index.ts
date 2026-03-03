import {createModuleCommands, defineCommand, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {TaskDefinition} from "../../types";

export const kernelCoreTaskCommands = createModuleCommands(moduleName,{
    open:defineCommand<{key:string}>(),
    take:defineCommand<{ bagId: string}>(),
    close:defineCommand<{ placeId:string }>(),
    run:defineCommand<{key:string}>(),


    updateTaskDefinitions: defineCommand<Record<string, ValueWithUpdatedAt<TaskDefinition> | undefined | null
    >>(),
})

