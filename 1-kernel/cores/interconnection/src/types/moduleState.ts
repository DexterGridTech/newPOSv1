import {kernelCoreInterconnectionState} from "./shared";
import {InstanceInfoState, MasterInterconnectionState, SlaveInterconnectionState} from "./state";

export interface KernelCoreInterconnectionState  {
    [kernelCoreInterconnectionState.instanceInfo]: InstanceInfoState
    [kernelCoreInterconnectionState.masterInterconnection]: MasterInterconnectionState
    [kernelCoreInterconnectionState.slaveInterconnection]: SlaveInterconnectionState
}