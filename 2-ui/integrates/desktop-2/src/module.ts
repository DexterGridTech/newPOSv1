import {kernalBaseModule, KernelModule} from "@impos2/kernel-base";
import {integrateActors} from "./features/integrateActors";
import {uiDeviceActivateModule} from "@impos2/ui-module-device-activate";
import {uiUserLoginModule} from "@impos2/ui-module-user-login";
import {moduleName} from "./moduleName";
import {uiSystemAdminModule} from "@impos2/ui-module-system-admin";

export const uiIntegrateDesktop2Module: KernelModule = {
    name: moduleName,
    reducers: {},
    epics: [],
    actors: integrateActors,
    screenParts: [],
    dependencies:[
        uiDeviceActivateModule,
        uiUserLoginModule,
        uiSystemAdminModule
    ]
}