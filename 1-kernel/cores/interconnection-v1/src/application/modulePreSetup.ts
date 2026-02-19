import {
    ActorSystem,
    ApplicationConfig,
    AppModule,
    Command,
    CommandConverter,
    INTERNAL,
    kernelCoreBaseParameters,
    LOG_TAGS,
    logger,
    RootState
} from "@impos2/kernel-core-base-v1";
import {DisplayMode, InstanceMode, kernelCoreInterconnectionState, MasterInfo, WorkSpace} from "../types";
import {defaultMasterInfo, defaultSlaveInfo} from "../foundations/masterServer";
import {kernelCoreInterconnectionCommands} from "../features/commands";
import {moduleName} from "../moduleName";
import {statesToSyncFromMasterToSlave, statesToSyncFromSlaveToMaster} from "../foundations/statesNeedToSync";
import {getInstanceMode, getWorkspace} from "../foundations/accessory";
import {SyncType} from "../types/shared/syncType";
import {dispatchInstanceModeAction} from "../foundations";
import {requestStatusActions} from "../features/slices/requestStatus";


export const kernelCoreInterconnectionModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    registerActorSystem()
    preInitiateInstanceInfo(config)

    ActorSystem.getInstance().registerCommandConverter(commandWithExtra)
    ActorSystem.getInstance().registerCommandConverter(remoteCommandConverter)

    setStateNeedToSync(allModules)
}
const registerActorSystem = () => {

    ActorSystem.getInstance().registerLifecycleListener({
        onCommandStart: (actor, command) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandStart({
                    actor: actor.printName(),
                    command: command,
                    requestCleanOutTime: kernelCoreBaseParameters.requestCleanOutTime.value
                }), command)
        },
        onCommandComplete: (actor, command, result?: Record<string, any>) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandComplete({
                    actor: actor.printName(),
                    command: command,
                    result: result
                }), command)
        },
        onCommandError: (actor, command, appError) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandError({
                    actor: actor.printName(),
                    command: command,
                    appError: appError
                }), command)
        }
    });
}
const setStateNeedToSync = (allModules: AppModule[]) => {
    allModules.forEach(module => {
        Object.values(module.slices).forEach(slice => {
            logger.log([moduleName, LOG_TAGS.System, "preSetup"], `read ${slice.name} with sync type ${slice.syncType}`)
            if (!slice.syncType || slice.syncType === SyncType.MASTER_TO_SLAVE)
                statesToSyncFromMasterToSlave.add(slice.name as keyof RootState)
            else if (slice.syncType === SyncType.SLAVE_TO_MASTER)
                statesToSyncFromSlaveToMaster.add(slice.name as keyof RootState)
        })
    })
}
const commandWithExtra: CommandConverter = {
    convertCommand: (command: Command<any>) => {
        if (!command.extra.workspace) {
            command.extra.workspace = getWorkspace()
        }
        if (!command.extra.instanceMode) {
            command.extra.instanceMode = getInstanceMode()
        }
        return command
    }
}

const remoteCommandConverter: CommandConverter = {
    convertCommand: (command: Command<any>) => {
        let commandToExecute = command

        if (command.extra.instanceMode !== getInstanceMode()) {
            commandToExecute = kernelCoreInterconnectionCommands.sendToRemoteExecute(command)
            commandToExecute.requestId = command.requestId
            commandToExecute.sessionId = command.sessionId
            commandToExecute.extra.instanceMode = getInstanceMode()
            commandToExecute.extra.workspace = command.extra.workspace
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