import {createModuleCommands, defineCommand, ScreenPart} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

export const kernelCoreUiRuntimeCommands = createModuleCommands(moduleName, {
    showScreen: defineCommand<{ target: ScreenPart<any>, source?: string }>(),
    replaceScreen: defineCommand<{ target: ScreenPart<any>, source?: string }>(),
    resetScreen: defineCommand<{ containerKey: string }>(),
    openOverlay: defineCommand<{ overlay: ScreenPart<any> }>(),
    closeOverlay: defineCommand<{ overlayId: string }>(),
    clearOverlays: defineCommand<void>(),
    setUiVariables: defineCommand<Record<string, any>>(),
    clearUiVariables: defineCommand<string[]>(),
})
