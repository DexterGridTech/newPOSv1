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
    RootState
} from "@impos2/kernel-core-base";
import {
    DisplayMode,
    InstanceInfoState,
    InstanceMode,
    kernelCoreInterconnectionState,
    MasterInfo,
    WorkSpace
} from "../types";
import {defaultMasterInfo, defaultSlaveInfo} from "../foundations/masterServer";
import {kernelCoreInterconnectionCommands} from "../features/commands";
import {moduleName} from "../moduleName";
import {statesNeedToSync} from "../foundations/statesNeedToSync";
import {getInstanceMode, getWorkspace} from "../foundations/accessory";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    config.preInitiatedState[kernelCoreInterconnectionState.instanceInfo]
        = preInitiateInstanceInfo(config)

    ActorSystem.getInstance().registerCommandConverter(commandWithWorkspaceConverter)
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
const commandWithWorkspaceConverter: CommandConverter = {
    convertCommand: (command: Command<any>) => {
        command.extra.workspace=getWorkspace()
        return command
    }
}

const remoteCommandConverter: CommandConverter = {
    convertCommand: (command: Command<any>) => {
        let commandToExecute = command
        const instanceMode = getInstanceMode()

        if (command.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_SLAVE
            && instanceMode === InstanceMode.MASTER) {
            throw new Error(`command 只能在slave模式下运行 ${command.commandName}`)
        } else if (command.executionType === ExecutionType.ONLY_SEND_AND_EXECUTE_ON_MASTER
            && instanceMode === InstanceMode.SLAVE) {
            throw new Error(`command 只能在Master模式下运行 ${command.commandName}`)
        } else if (command.executionType === ExecutionType.SLAVE_SEND_MASTER_EXECUTE
            && instanceMode === InstanceMode.SLAVE) {
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
    const workspace = (instanceMode === InstanceMode.SLAVE && displayMode === DisplayMode.PRIMARY) ? WorkSpace.Branch : WorkSpace.Main


    defaultMasterInfo.name = `Master-${environment.deviceId}`
    defaultMasterInfo.deviceId = environment.deviceId
    defaultSlaveInfo.name = `Slave-${environment.deviceId}`
    defaultSlaveInfo.deviceId = environment.deviceId

    const masterInfo: MasterInfo | null = !standalone ? {...defaultMasterInfo} : null
    const instanceInfoState: InstanceInfoState = {
        instanceMode: instanceMode,
        displayMode: displayMode,
        workspace: workspace,
        standalone: standalone,
        enableSlave: enableSlave,
        masterInfo: masterInfo,
    }
    return instanceInfoState
}