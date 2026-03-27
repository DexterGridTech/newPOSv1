import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {UserActor} from "./user";
import {UnitDataActor} from "./unitData";


export const kernelUserBaseActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    userActor:UserActor,
    unitDataActor:UnitDataActor
});
