import {CommandHandler, deviceController, dispatchAction, IActor, ICommand, logger,} from "../../core";
import {InitializeCommand} from "../commands";
import {deviceStatusActions} from "../slices";
import {LOG_TAGS} from '../../types/core/logTags';
import {moduleName} from '../../moduleName';

class DeviceStatusActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
        this.getSystemStatus(command)
    }

    private getSystemStatus(command: ICommand<any>) {
        deviceController.getSystemStatus()
            ?.then(systemStatus =>
                dispatchAction(deviceStatusActions.setSystemStatus(systemStatus as any), command)
            )
            .catch(error => logger.error([moduleName, LOG_TAGS.Actor, "deviceStatus"], 'Error getting system status', error))
            .finally(() => {
            })
        setTimeout(() => {
            this.getSystemStatus(command)
        }, 600000)
    }
}

export const deviceStatusActor = new DeviceStatusActor()