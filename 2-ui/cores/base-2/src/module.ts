import {kernalBaseModule, KernelModule} from "@impos2/kernel-base";
import {moduleScreenParts} from "./basic";
import {kernelUiNavigationModule} from "@impos2/kernel-module-ui-navigation";

export const uiCoreBaseModule: KernelModule = {
    name: 'ui-core-base',
    reducers: {},
    epics: [],
    actors: [],
    screenParts: moduleScreenParts,
    dependencies:[
        kernalBaseModule,
        kernelUiNavigationModule
    ]
}