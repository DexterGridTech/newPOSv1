import {KernelModule} from "@impos2/kernel-base";
import {moduleActors} from "./features";
import {moduleScreenParts} from "./screens";
import {uiCoreBaseModule} from "@impos2/ui-core-base-2";
import {kernelUiNavigationModule} from "@impos2/kernel-module-ui-navigation";
import {kernalUserModule} from "@impos2/kernel-module-user";

export const uiUserLoginModule: KernelModule = {
    name: 'ui-user-login',
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