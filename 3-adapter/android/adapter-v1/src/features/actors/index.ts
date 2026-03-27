import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const adapterAndroidActors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
