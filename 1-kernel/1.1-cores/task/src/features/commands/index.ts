import {createModuleCommands, defineCommand, ValueWithUpdatedAt,TaskDefinition} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreTaskCommands = createModuleCommands(moduleName,{
    open:defineCommand<{key:string}>(),
    take:defineCommand<{ bagId: string}>(),
    close:defineCommand<{ placeId:string }>(),
    run:defineCommand<{key:string}>(),

    executeTask:defineCommand<{taskDefinitionKey:string,initContext:any}>(),

    updateTaskDefinitions: defineCommand<Record<string, ValueWithUpdatedAt<TaskDefinition> | undefined | null
    >>(),
})

