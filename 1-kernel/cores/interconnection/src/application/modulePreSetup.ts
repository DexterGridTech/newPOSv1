import {ApplicationConfig, AppModule} from "@impos2/kernel-core-base";
import {
    DisplayMode,
    InstanceInfoState,
    InstanceMode,
    kernelCoreInterconnectionState,
    MasterInfo,
    SlaveInfo
} from "../types";
import {defaultServerAddresses} from "../foundations/masterServer";


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
    const masterInfo: MasterInfo | null = !standalone ? {
        name: `Master-${environment.deviceId}`,
        deviceId: environment.deviceId,
        serverAddress: defaultServerAddresses,
        addedAt: Date.now()
    } : null
    const slaveInfo: SlaveInfo | null = enableSlave ? {
        name: `Slave-${environment.deviceId}`,
        embedded: true,
        deviceId: environment.deviceId,
        addedAt: Date.now()
    } : null
    const instanceInfoState: InstanceInfoState = {
        instanceMode: instanceMode,
        displayMode: displayMode,
        standalone: standalone,
        enableSlave: enableSlave,
        masterInfo: masterInfo,
        slaveInfo: slaveInfo
    }
    return instanceInfoState
}