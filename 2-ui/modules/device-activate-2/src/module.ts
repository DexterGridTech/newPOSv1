import {KernelModule} from "@impos2/kernel-base";
import {moduleActors} from "./features";
import {uiCoreBaseModule} from "@impos2/ui-core-base-2";
import {kernelUiNavigationModule} from "@impos2/kernel-module-ui-navigation";
import {moduleName} from './moduleName';
import {moduleScreenParts} from "./moduleScreenParts";

export const uiDeviceActivateModule: KernelModule = {
    name: moduleName,
    reducers: {},
    epics: [],
    actors: moduleActors,
    screenParts: moduleScreenParts,
    dependencies:[
        kernelUiNavigationModule,
        uiCoreBaseModule
    ]
}
