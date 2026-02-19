import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";
import {ScreenPart} from "../../types/foundations/screen";

export const kernelCoreNavigationCommands = createModuleCommands(moduleName, {
    //数据同步
    openModal: defineCommand<{ model: ScreenPart<any> }>(),
    closeModal: defineCommand<{ modelId: string }>(),
})

