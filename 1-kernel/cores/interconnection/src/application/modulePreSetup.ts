import {ApplicationConfig, AppModule} from "@impos2/kernel-core-base";
import {DisplayMode, InstanceInfoState, InstanceMode, kernelCoreInterconnectionState, MasterInfo} from "../types";
import {defaultMasterInfo, defaultSlaveInfo} from "../foundations/masterServer";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    config.preInitiatedState[kernelCoreInterconnectionState.instanceInfo]
        = preInitiateInstanceInfo(config)
}


const preInitiateInstanceInfo = (config: ApplicationConfig) => {
    const environment = config.environment
    const standalone = environment.displayIndex === 0
    const enableSlave = environment.displayCount > 1 && standalone
    const instanceMode = standalone ? InstanceMode.MASTER : InstanceMode.SLAVE
    const displayMode = standalone ? DisplayMode.PRIMARY : DisplayMode.SECONDARY
    defaultMasterInfo.name = `Master-${environment.deviceId}`
    defaultMasterInfo.deviceId = environment.deviceId
    defaultSlaveInfo.name = `Slave-${environment.deviceId}`
    defaultSlaveInfo.deviceId = environment.deviceId

    const masterInfo: MasterInfo | null = !standalone ? {...defaultMasterInfo} : null
    const instanceInfoState: InstanceInfoState = {
        instanceMode: instanceMode,
        displayMode: displayMode,
        standalone: standalone,
        enableSlave: enableSlave,
        masterInfo: masterInfo,
    }
    return instanceInfoState
}