import {baseModuleActors, baseModuleEpics, baseModuleReducers,} from "./features";
import {KernelModule} from "./store";

export const kernalBaseModule: KernelModule = {
    name: 'kernel-base',
    reducers: baseModuleReducers,
    epics: baseModuleEpics,
    actors: baseModuleActors,
}
