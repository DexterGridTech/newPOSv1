import {kernalBaseModule, KernelModule} from "@impos2/kernel-base";
import {moduleScreenParts} from "./basic";
import {kernelUiNavigationModule} from "@impos2/kernel-module-ui-navigation";
import {moduleName} from "./types";

export const uiCoreBaseModule: KernelModule = {
    name: moduleName,
    reducers: {},
    epics: [],
    actors: [],
    screenParts: moduleScreenParts,
    dependencies:[
        kernalBaseModule,
        kernelUiNavigationModule
    ]
}