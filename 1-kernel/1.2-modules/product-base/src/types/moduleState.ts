import {kernelProductBaseState} from "./shared/moduleStateKey";
import {ProductState} from "./state/product";

export interface KernelProductBaseState {
    [kernelProductBaseState.product]: ProductState
}
