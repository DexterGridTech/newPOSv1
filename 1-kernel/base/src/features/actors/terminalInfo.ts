import {APIError, APIErrorCode, CommandHandler, currentState, dispatchAction, IActor} from "../../core";
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
import {terminalInfoActions, deviceStatusSlice, terminalInfoSlice} from "../slices";
import {ActivateDeviceRequest, kernelDeviceAPI, SetOperatingEntityRequest} from "../../api/device";


class TerminalInfoActor extends IActor {
    @CommandHandler(InitializeCommand)
    private async handleInitialize(command: InitializeCommand) {
    }

    @CommandHandler(ActivateDeviceCommand)
    private async handleActivateDevice(command: ActivateDeviceCommand) {
        const {activateCode} = command.payload;
        const state = currentState<RootState>()
        const deviceInfo = state[deviceStatusSlice.name].deviceInfo
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
        const state = currentState<RootState>()
        const operatingEntity = command.payload;
        const deviceInfo = state[deviceStatusSlice.name].deviceInfo
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

kernelTokenGetter.get = () => currentState<RootState>()[terminalInfoSlice.name].token

export const terminalInfoActor = new TerminalInfoActor()