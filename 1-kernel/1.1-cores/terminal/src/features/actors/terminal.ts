import {Actor, APIError, APIResponseCode, getDeviceId, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {
    ActivateDeviceRequest,
    DeactivateDeviceRequest,
    SendDeviceStateRequest,
    SetOperatingEntityRequest
} from "../../types/foundations/api";
import {kernelCoreTerminalApis} from "../../supports";
import {terminalActions} from "../slices/terminal";
import {kernelCoreTerminalState} from "../../types/shared/moduleStateKey";

export class TerminalActor extends Actor {
    activateDevice = Actor.defineCommandHandler(kernelCoreTerminalCommands.activateDevice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'activateDevice', command.payload)
            const deviceInfo = storeEntry.getStateByKey(kernelCoreTerminalState.terminal).deviceInfo!.value
            const activeDeviceRequest: ActivateDeviceRequest = {
                activeCode: command.payload,
                device: deviceInfo
            }
            const result = await kernelCoreTerminalApis.activateDevice.run({request: activeDeviceRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(terminalActions.setTerminal(result.data!))

                kernelCoreTerminalCommands.setOperatingEntity(result.data!.hostEntity).executeFromParent(command)
                kernelCoreTerminalCommands.activateDeviceSuccess().executeFromParent(command)

                return {
                    activateDevice: result.data
                }
            } else {
                throw new APIError(result)
            }
        });

    setOperatingEntity = Actor.defineCommandHandler(kernelCoreTerminalCommands.setOperatingEntity,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'setOperatingEntity', command.payload)
            const setOperatingEntityRequest: SetOperatingEntityRequest = {
                deviceId: getDeviceId(),
                operatingEntityId: command.payload.id
            }
            const result = await kernelCoreTerminalApis.setOperatingEntity.run({request: setOperatingEntityRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(terminalActions.setOperatingEntity(command.payload))
                kernelCoreTerminalCommands.setOperatingEntitySuccess().executeFromParent(command)
                return {
                    operatingEntity: command.payload
                }
            } else {
                throw new APIError(result)
            }
        });

    deactivateDevice = Actor.defineCommandHandler(kernelCoreTerminalCommands.deactivateDevice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'deactivateDevice', command.payload)
            const deactivateDeviceRequest: DeactivateDeviceRequest = {
                deviceId: getDeviceId(),
                deactiveCode: command.payload
            }
            const result = await kernelCoreTerminalApis.deactivateDevice.run({request: deactivateDeviceRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                kernelCoreTerminalCommands.deactivateDeviceSuccess().executeFromParent(command)
                return {}
            } else {
                throw new APIError(result)
            }
        });

    sendStateToServer = Actor.defineCommandHandler(kernelCoreTerminalCommands.sendStateToServer,
        async (command): Promise<Record<string, any>> => {
            const state = storeEntry.getState()
            const deviceId = getDeviceId()
            const request: SendDeviceStateRequest = {deviceId, state}
            const result = await kernelCoreTerminalApis.sendDeviceState.run({request: request})
            if (result.code === APIResponseCode.SUCCESS) {
                logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], '成功向服务器发送当前状态')
                return {}
            } else {
                throw new APIError(result)
            }
        });
}

