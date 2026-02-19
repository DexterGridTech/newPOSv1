import {createModuleCommands, defineCommand} from "../../foundations";
import {moduleName} from "../../moduleName";
import {ValueWithUpdateAt} from "../../types";


export const kernelCoreBaseCommands =
    createModuleCommands(moduleName, {

        initialize: defineCommand<void>(),

        updateErrorMessages: defineCommand<Record<string, ValueWithUpdateAt<string> | undefined | null
        >>(),

        updateSystemParameters: defineCommand<Record<string, ValueWithUpdateAt<any> | undefined | null
        >>()
    })