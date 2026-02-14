import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {MasterInterconnectionActor} from "./masterInterconnection";
import {SlaveInterconnectionActor} from "./slaveInterconnection";


export const kernelCoreInterconnectionActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    masterInterconnectionActor:MasterInterconnectionActor,
    slaveInterconnectionActor:SlaveInterconnectionActor
});
