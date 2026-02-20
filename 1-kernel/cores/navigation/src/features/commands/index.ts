import {createModuleCommands, defineCommand, ScreenPart} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreNavigationCommands = createModuleCommands(moduleName, {
    //数据同步
    openModal: defineCommand<{ modal: ScreenPart<any> }>(),
    closeModal: defineCommand<{ modalId: string }>(),
    setUiVariables: defineCommand<Record<string, any>>(),
    clearUiVariables: defineCommand<string[]>(),
})

