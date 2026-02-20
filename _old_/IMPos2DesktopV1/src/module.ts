import {KernelModule} from "../../../../_old_/base";
import {moduleName} from "./moduleName.ts";
import {moduleActors} from "./features/moduleActors.ts";
import {uiIntegrateDesktop2Module} from "@impos2/integrate-desktop-2";


export const assemblyModule:KernelModule={
    name:moduleName,
    reducers:{},
    epics:[],
    actors:moduleActors,
    screenParts:[],
    dependencies:[uiIntegrateDesktop2Module]
}