import {Command, CommandConverter, LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";
import {getInstanceMode, getWorkspace} from "./accessory";
import {kernelCoreInterconnectionCommands} from "../features/commands";
import {moduleName} from "../moduleName";

export const remoteCommandConverter: CommandConverter = {
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

export const commandWithExtra: CommandConverter = {
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
