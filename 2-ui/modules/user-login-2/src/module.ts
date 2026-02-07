import {KernelModule} from "@impos2/kernel-base";
import {moduleActors} from "./features";
import {moduleScreenParts} from "./screens";
import {uiCoreBaseModule} from "@impos2/ui-core-base-2";
import {kernelUiNavigationModule} from "@impos2/kernel-module-ui-navigation";
import {kernalUserModule} from "@impos2/kernel-module-user";
import {moduleName} from "./types";

export const uiUserLoginModule: KernelModule = {
    name: moduleName,
    reducers: {},
    epics: [],
    actors: moduleActors,
    screenParts: moduleScreenParts,
    dependencies:[
        kernelUiNavigationModule,
        kernalUserModule,
        uiCoreBaseModule
    ]
}