import {ErrorMessagesState, SystemParametersState} from "./state";
import {kernelCoreBaseState} from "./shared";
 interface KernelCoreBaseState {
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
}
export interface RootState extends KernelCoreBaseState{
}