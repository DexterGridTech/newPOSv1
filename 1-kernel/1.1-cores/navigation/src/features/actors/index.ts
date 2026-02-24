import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {NavigateActor} from "./navigate";
import {UiVariableActor} from "./uiVariable";


export const kernelCoreNavigationActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    navigateActor:NavigateActor,
    uiVariableActor:UiVariableActor
});
