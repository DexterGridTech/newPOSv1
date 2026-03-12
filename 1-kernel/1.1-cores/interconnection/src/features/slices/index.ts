import {instanceInfoConfig} from "./instanceInfo";
import {instanceInterconnectionConfig} from "./instanceInterconnection";
import {toInstanceModeModuleSliceConfigs} from "../../foundations";
import {requestStatusConfig} from "./requestStatus";
import {slaveStatusConfig} from "./slaveStatus";

export const kernelCoreInterconnectionSlice = {
    instanceInfo: instanceInfoConfig,
    instanceInterconnection: instanceInterconnectionConfig,
    slaveStatus: slaveStatusConfig,
    ...toInstanceModeModuleSliceConfigs(requestStatusConfig)
}