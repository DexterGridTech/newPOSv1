import {createModuleCommands, defineCommand, ExecutionType} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreInterconnectionCommands = createModuleCommands(moduleName,{
    startMasterServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER),
    connectMasterServer: defineCommand<void>(ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE)
})

