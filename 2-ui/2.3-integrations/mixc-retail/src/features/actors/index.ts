import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {NavigateActor} from "./navigate";


export const uiIntegrationMixcRetailActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    navigateActor:NavigateActor
});
