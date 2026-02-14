import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {MasterInterconnectionActor} from "./masterInterconnection";
import {SlaveInterconnectionActor} from "./slaveInterconnection";
import {InstanceInfoActor} from "./instanceInfo";


export const kernelCoreInterconnectionActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    instanceInfoActor:InstanceInfoActor,
    masterInterconnectionActor:MasterInterconnectionActor,
    slaveInterconnectionActor:SlaveInterconnectionActor
});
