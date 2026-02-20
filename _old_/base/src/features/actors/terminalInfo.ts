import {APIError, APIErrorCode, CommandHandler, dispatchAction, IActor, storeEntry} from "../../core";
import {kernelTokenGetter} from "../../api";
import {RootState} from "../rootState";
import {
    ActivateDeviceCommand,
    ActivateDeviceSuccessCommand,
    DeactivateDeviceCommand,
    InitializeCommand,
    SetOperatingEntityCommand,
    SetOperatingEntityCompleteCommand
} from "../commands";
import {terminalInfoActions} from "../slices";
import {ActivateDeviceRequest, kernelDeviceAPI, SetOperatingEntityRequest} from "../../api/device";
import {KernelBaseStateNames} from "../../types/stateNames";


class TerminalInfoActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
    }

    @CommandHandler(ActivateDeviceCommand)
    private async handleActivateDevice(command: ActivateDeviceCommand) {
        const {activateCode} = command.payload;
        const deviceInfo = storeEntry.getDeviceInfo()
        if (deviceInfo) {
            const activeDeviceRequest: ActivateDeviceRequest = {
                activeCode: activateCode,
                device: deviceInfo
            }
            const result = await kernelDeviceAPI.activateDevice.run({request: activeDeviceRequest})
            if (result.code === APIErrorCode.SUCCESS) {
                dispatchAction(terminalInfoActions.setTerminalInfo(result.data!), command)
                new SetOperatingEntityCommand(result.data!.hostEntity).executeFromParent(command)
                new ActivateDeviceSuccessCommand().executeFromParent(command)

                return {
                    [command.commandName]: result.data
                }
            } else {
                throw new APIError(result)
            }
        }
    }

    @CommandHandler(DeactivateDeviceCommand)
    private async handleDeactivateDevice(command: DeactivateDeviceCommand) {
    }

    @CommandHandler(SetOperatingEntityCommand)
    private async handleSetOperatingEntity(command: SetOperatingEntityCommand) {
        const operatingEntity = command.payload;
        const deviceInfo = storeEntry.getDeviceInfo()
        if (deviceInfo) {
            const setOperatingEntityRequest: SetOperatingEntityRequest = {
                deviceId: deviceInfo.id,
                operatingEntityId: operatingEntity.id
            }
            const result = await kernelDeviceAPI.setOperatingEntity.run({request: setOperatingEntityRequest})
            if (result.code === APIErrorCode.SUCCESS) {
                dispatchAction(terminalInfoActions.setOperatingEntity(operatingEntity), command)
                new SetOperatingEntityCompleteCommand().executeFromParent(command)
            } else {
                throw new APIError(result)
            }
        }
    }
}

kernelTokenGetter.get = () => storeEntry.getTerminalToken()

export const terminalInfoActor = new TerminalInfoActor()