import {ErrorMessagesState, RequestStatusState, SystemParametersState} from "./state";
import {kernelCoreBaseState} from "./shared";

export interface PersistPartial {
    _persist: {
        version: number;
        rehydrated: boolean;
    };
}


 interface KernelCoreBaseState {
    [kernelCoreBaseState.requestStatus]: RequestStatusState;
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
}
export interface RootState extends KernelCoreBaseState,PersistPartial{
}