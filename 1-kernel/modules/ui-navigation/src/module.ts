import {KernelModule} from "@impos2/kernel-base";
import {uiNavigationModuleActors, uiNavigationModuleReducers} from "./features";
import {moduleName} from "./types";


export const kernelUiNavigationModule: KernelModule = {
    name: moduleName,
    reducers: uiNavigationModuleReducers,
    actors: uiNavigationModuleActors,
    epics: [],
};
