import {ErrorMessagesState, RequestStatusState, SystemParametersState} from "./state";
import {kernelCoreBaseState} from "./shared";
 interface KernelCoreBaseState {
    [kernelCoreBaseState.requestStatus]: RequestStatusState;
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
}
export interface RootState extends KernelCoreBaseState{
}