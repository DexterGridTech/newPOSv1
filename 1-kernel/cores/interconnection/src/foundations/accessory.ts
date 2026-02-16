import {DisplayMode, InstanceMode, kernelCoreInterconnectionState} from "../types";
import {storeEntry} from "@impos2/kernel-core-base";


export const getInstanceMode = (): InstanceMode => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).instanceMode
}
export const getDisplayMode = (): DisplayMode => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).displayMode
}
export const getStandalone = (): boolean => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).standalone
}


