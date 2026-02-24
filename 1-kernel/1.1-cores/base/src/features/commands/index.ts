import {createModuleCommands, defineCommand} from "../../foundations";
import {moduleName} from "../../moduleName";
import {ValueWithUpdatedAt} from "../../types";


export const kernelCoreBaseCommands =
    createModuleCommands(moduleName, {

        initialize: defineCommand<void>(),

        updateErrorMessages: defineCommand<Record<string, ValueWithUpdatedAt<string> | undefined | null
        >>(),

        updateSystemParameters: defineCommand<Record<string, ValueWithUpdatedAt<any> | undefined | null
        >>(),

        clearDataCache: defineCommand<void>(),
        switchServerSpace: defineCommand<string>(),
    })