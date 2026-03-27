import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {ProductActor} from "./product";


export const kernelProductBaseActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    productActor:ProductActor
});
