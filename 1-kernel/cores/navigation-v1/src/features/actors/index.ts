import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base-v1";
import {InitializeActor} from "./initialize";
import {UiModalActor} from "./uiModal";


export const kernelCoreNavigationActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    uiModalActor:UiModalActor
});
