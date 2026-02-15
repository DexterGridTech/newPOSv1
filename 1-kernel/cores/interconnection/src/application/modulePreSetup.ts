import {
    ActorSystem,
    ApplicationConfig,
    AppModule,
    Command,
    CommandConverter,
    ExecutionType,
    INTERNAL,
    LOG_TAGS,
    logger,
    storeEntry
} from "@impos2/kernel-core-base";
import {DisplayMode, InstanceInfoState, InstanceMode, kernelCoreInterconnectionState, MasterInfo} from "../types";
import {defaultMasterInfo, defaultSlaveInfo} from "../foundations/masterServer";
import {kernelCoreInterconnectionCommands} from "../features/commands";
import {moduleName} from "../moduleName";
import {statesNeedToSync} from "../foundations/statesNeedToSync";
import type {RootState} from "@impos2/kernel-base";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    config.preInitiatedState[kernelCoreInterconnectionState.instanceInfo]
        = preInitiateInstanceInfo(config)

    ActorSystem.getInstance().registerCommandConverter(remoteCommandConverter)

    setStateNeedToSync(allModules)
}

const setStateNeedToSync = (allModules: AppModule[]) => {
    allModules.forEach(module => {
        Object.values(module.slices).forEach(slice => {
            if (slice.stateSyncToSlave)
                statesNeedToSync.add(slice.name as keyof RootState)
        })
    })
}

const remoteCommandConverter: CommandConverter = {
    convertCommand: (command: Command<any>) => {
        let commandToExecute = command
        const instanceInfo = storeEntry.state(kernelCoreInterconnectionState.instanceInfo)
        instanceInfo.instanceMode

        if (command.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
            && instanceInfo.instanceMode === InstanceMode.MASTER) {
            throw new Error(`command 只能在slave模式下运行 ${command.commandName}`)
        } else if (command.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
            && instanceInfo.instanceMode === InstanceMode.SLAVE) {
            throw new Error(`command 只能在Master模式下运行 ${command.commandName}`)
        } else if (command.executionType === ExecutionType.SLAVE_SEND_MASTER_EXECUTE
            && instanceInfo.instanceMode === InstanceMode.SLAVE) {
            if (command.requestId === INTERNAL) {
                throw new Error(`远程命令requestId不可以是INTERNAL ${command.commandName}`)
            }
            commandToExecute = kernelCoreInterconnectionCommands.slaveSendMasterExecute(command)
            commandToExecute.requestId = command.requestId
            commandToExecute.sessionId = command.sessionId
            logger.log([moduleName, LOG_TAGS.System, "remoteCommandConverter"], `远程调用转换${command.commandName}->${commandToExecute.commandName}`)
        }
        return commandToExecute
    }
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