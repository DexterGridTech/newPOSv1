import {instanceInfoConfig} from "./instanceInfo";
import {instanceInterconnectionConfig} from "./instanceInterconnection";
import {toInstanceModeModuleSliceConfigs} from "../../foundations";
import {requestStatusConfig} from "./requestStatus";

export const kernelCoreInterconnectionSlice = {
    instanceInfo: instanceInfoConfig,
    instanceInterconnection: instanceInterconnectionConfig,
    ...toInstanceModeModuleSliceConfigs(requestStatusConfig)
}