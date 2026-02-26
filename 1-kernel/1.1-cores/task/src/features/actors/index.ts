import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {TaskTestActor} from "./taskTestActor";


export const kernelCoreTaskActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    taskTestActor:TaskTestActor
});
