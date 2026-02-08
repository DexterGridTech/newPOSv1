import {KernelModule} from "@impos2/kernel-base";
import {userModuleActors, userModuleReducers} from "./features";
import {moduleName} from "./moduleName";


export const kernalUserModule: KernelModule = {
    name: moduleName,
    reducers: userModuleReducers,
    actors: userModuleActors,
    epics: [],
}

