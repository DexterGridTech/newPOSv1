import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {ProductOrderActor} from "./productOrder";


export const kernelOrderCreateTraditionalActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    productOrderActor:ProductOrderActor
});
