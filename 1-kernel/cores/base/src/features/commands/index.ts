import {createModuleCommands, defineCommand} from "../../foundations";
import {moduleName} from "../../moduleName";
import {ExecutionType} from "../../types";

export const kernelCoreBaseCommands = createModuleCommands({
    initialize: defineCommand<void>(ExecutionType.SEND_AND_EXECUTE_SEPARATELY, moduleName),
})

