import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const uiWorkbenchActors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
