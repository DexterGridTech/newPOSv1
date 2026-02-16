import {createModuleCommands, defineCommand} from "../../foundations";
import {moduleName} from "../../moduleName";
import {ExecutionType, ValueWithUpdateAt} from "../../types";


export const kernelCoreBaseCommands =
    createModuleCommands(moduleName, {

        initialize: defineCommand<void>(ExecutionType.SEND_AND_EXECUTE_SEPARATELY),

        updateErrorMessages: defineCommand<Record<string, ValueWithUpdateAt<string> | undefined | null
        >>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),

        updateSystemParameters: defineCommand<Record<string, ValueWithUpdateAt<any> | undefined | null
        >>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER)
    })