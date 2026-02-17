import {DisplayMode, InstanceMode, kernelCoreInterconnectionState, WorkSpace} from "../types";
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
export const getWorkspace = (): WorkSpace => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).workspace
}


