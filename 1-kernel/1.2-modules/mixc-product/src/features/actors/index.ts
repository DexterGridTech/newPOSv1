import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {UnitDataActor} from "./unitData";
import {ContractActor} from "./contract";


export const kernelMixcProductActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    unitDataActor:UnitDataActor,
    contractActor:ContractActor
});
