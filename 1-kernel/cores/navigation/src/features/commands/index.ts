import {createModuleCommands, defineCommand, ExecutionType} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {AlertCommand, CloseModalCommand, OpenModalCommand, ScreenPart} from "@impos2/kernel-base";

export const kernelCoreNavigationCommands = createModuleCommands(moduleName,{
    //数据同步
    openModal: defineCommand<{ model: ScreenPart }>(ExecutionType.SEND_AND_EXECUTE_SEPARATELY),
    closeModal: defineCommand<{ modelId: string }>(ExecutionType.SEND_AND_EXECUTE_SEPARATELY),
})

