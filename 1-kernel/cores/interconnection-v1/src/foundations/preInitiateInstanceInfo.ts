import {ApplicationConfig} from "@impos2/kernel-core-base-v1";
import {DisplayMode, InstanceMode, kernelCoreInterconnectionState, MasterInfo, WorkSpace} from "../types";
import {defaultMasterInfo, defaultSlaveInfo} from "./masterServer";


export const preInitiateInstanceInfo = (config: ApplicationConfig) => {
    const environment = config.environment
    const standalone = environment.displayIndex === 0
    const enableSlave = environment.displayCount > 1 && standalone
    const instanceMode = standalone ? InstanceMode.MASTER : InstanceMode.SLAVE
    const displayMode = standalone ? DisplayMode.PRIMARY : DisplayMode.SECONDARY
    const workspace = (instanceMode === InstanceMode.SLAVE && displayMode === DisplayMode.PRIMARY) ? WorkSpace.BRANCH : WorkSpace.MAIN


    defaultMasterInfo.deviceId = environment.deviceId
    defaultSlaveInfo.deviceId = standalone ? environment.deviceId : `slave-${environment.deviceId}`

    const masterInfo: MasterInfo | null = !standalone ? {...defaultMasterInfo} : null
    config.preInitiatedState[kernelCoreInterconnectionState.instanceInfo] = {
        instanceMode: instanceMode,
        displayMode: displayMode,
        workspace: workspace,
        standalone: standalone,
        enableSlave: enableSlave,
        masterInfo: masterInfo,
    }
}