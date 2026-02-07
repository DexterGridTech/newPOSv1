import {baseModuleActors, baseModuleEpics, baseModuleReducers,} from "./features";
import {KernelModule} from "./store";
import {moduleName} from "./types";

export const kernalBaseModule: KernelModule = {
    name: moduleName,
    reducers: baseModuleReducers,
    epics: baseModuleEpics,
    actors: baseModuleActors,
}
