import {createModuleCommands, defineCommand} from "../../foundations";
import {moduleName} from "../../moduleName";
import {ExecutionType, ValueWithUpdate} from "../../types";

export const kernelCoreBaseCommands = createModuleCommands({
    initialize: defineCommand<void>(ExecutionType.SEND_AND_EXECUTE_SEPARATELY, moduleName),
    updateErrorMessages: defineCommand<Record<string, ValueWithUpdate<string> | undefined | null
    >>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER, moduleName),
    updateSystemParameters: defineCommand<Record<string, ValueWithUpdate<any> | undefined | null
    >>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER, moduleName)
})

