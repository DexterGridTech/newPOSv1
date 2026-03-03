import {kernelCoreInterconnectionInstanceState, kernelCoreInterconnectionState} from "./shared";
import {
    InstanceInfoState,
    InstanceInterconnectionState,
} from "./state";
import {RequestStatusState} from "./state/requestStatus";
import {CreateModuleInstanceModeStateType} from "./foundations/instanceModeStateKeys";

export interface KernelCoreInterconnectionState {
    [kernelCoreInterconnectionState.instanceInfo]: InstanceInfoState
    [kernelCoreInterconnectionState.instanceInterconnection]: InstanceInterconnectionState
}

export type KernelCoreInterconnectionInstanceState = CreateModuleInstanceModeStateType<{
    [kernelCoreInterconnectionInstanceState.requestStatus]: RequestStatusState
}>