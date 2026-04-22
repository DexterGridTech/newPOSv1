import { kernelCoreInterconnectionState } from "../types";
import { storeEntry } from "@impos2/kernel-core-base";
export const getInstanceMode = () => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).instanceMode;
};
export const getDisplayMode = () => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).displayMode;
};
export const getStandalone = () => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).standalone;
};
export const getWorkspace = () => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).workspace;
};
export const getEnableSlave = () => {
    return storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo).enableSlave;
};
