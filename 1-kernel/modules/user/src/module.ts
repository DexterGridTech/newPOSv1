import {KernelModule} from "@impos2/kernel-base";
import {userModuleActors, userModuleReducers} from "./features";


export const kernalUserModule: KernelModule = {
    name: 'kernel-user',
    reducers: userModuleReducers,
    actors: userModuleActors,
    epics: [],
}

