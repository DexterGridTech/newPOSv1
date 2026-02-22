import {createModuleCommands, defineCommand, ScreenPart} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreNavigationCommands = createModuleCommands(moduleName, {
    navigateTo: defineCommand<{ target: ScreenPart<any> }>(),
    openModal: defineCommand<{ modal: ScreenPart<any> }>(),
    closeModal: defineCommand<{ modalId: string }>(),
    setUiVariables: defineCommand<Record<string, any>>(),
    clearUiVariables: defineCommand<string[]>(),
})

