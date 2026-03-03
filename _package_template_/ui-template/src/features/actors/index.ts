import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const uiXXXActors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
