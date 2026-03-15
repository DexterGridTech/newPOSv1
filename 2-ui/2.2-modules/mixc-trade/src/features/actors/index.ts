import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {OrderCreationActor} from "./orderCreation";


export const uiMixcTradeActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    orderCreationActor:OrderCreationActor
});
