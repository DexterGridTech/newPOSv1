import {CommandHandler, deviceController, dispatchAction, IActor, ICommand, logger,} from "../../core";
import {InitializeCommand} from "../commands";
import {deviceStatusActions} from "../slices";

class DeviceStatusActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
        this.getSystemStatus(command)
    }

    private getSystemStatus(command: ICommand<any>) {
        deviceController.getSystemStatus()
            .then(systemStatus =>
                dispatchAction(deviceStatusActions.setSystemStatus(systemStatus), command)
            )
            .catch(error => logger.error(error))
            .finally(() => {
            })
        setTimeout(() => {
            this.getSystemStatus(command)
        }, 600000)
    }
}

export const deviceStatusActor = new DeviceStatusActor()