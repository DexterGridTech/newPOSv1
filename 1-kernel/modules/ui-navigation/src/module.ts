import {KernelModule} from "@impos2/kernel-base";
import {uiNavigationModuleActors, uiNavigationModuleReducers} from "./features";
import {moduleName} from "./moduleName";


export const kernelUiNavigationModule: KernelModule = {
    name: moduleName,
    reducers: uiNavigationModuleReducers,
    actors: uiNavigationModuleActors,
    epics: [],
};
