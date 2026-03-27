import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const uiCoreAdapterTestActors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
