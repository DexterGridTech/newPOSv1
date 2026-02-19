import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base-v1";
import {InitializeActor} from "./initialize";
import {InstanceInterconnectionActor} from "./instanceInterconnection";
import {InstanceInfoActor} from "./instanceInfo";


export const kernelCoreInterconnectionActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    instanceInfoActor:InstanceInfoActor,
    instanceInterconnectionActor:InstanceInterconnectionActor
});
