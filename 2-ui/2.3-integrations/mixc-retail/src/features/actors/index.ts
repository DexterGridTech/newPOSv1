import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {NavigateActor} from "./navigate";
import {SwitchDisplayActor} from "./switchDisplay";


export const uiIntegrationMixcRetailActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    navigateActor:NavigateActor,
    switchDisplayActor:SwitchDisplayActor
});
