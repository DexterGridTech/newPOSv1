import {KernelModule} from "@impos2/kernel-base";
import {uiNavigationModuleActors, uiNavigationModuleReducers} from "./features";


export const kernelUiNavigationModule: KernelModule = {
    name: 'kernel-ui-navigation',
    reducers: uiNavigationModuleReducers,
    actors: uiNavigationModuleActors,
    epics: [],
};
