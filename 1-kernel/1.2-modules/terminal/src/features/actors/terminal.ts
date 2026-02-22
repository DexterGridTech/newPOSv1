import {Actor, APIError, APIResponseCode, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {kernelTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {ActivateDeviceRequest, DeactivateDeviceRequest, SetOperatingEntityRequest} from "../../types/foundations/api";
import {kernelTerminalApis} from "../../supports";
import {terminalActions} from "../slices/terminal";
import {kernelTerminalState} from "../../types/shared/moduleStateKey";

export class TerminalActor extends Actor {
    activateDevice = Actor.defineCommandHandler(kernelTerminalCommands.activateDevice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'activateDevice', command.payload)
            const deviceInfo = storeEntry.getStateByKey(kernelTerminalState.terminal).deviceInfo!.value
            const activeDeviceRequest: ActivateDeviceRequest = {
                activeCode: command.payload,
                device: deviceInfo
            }
            const result = await kernelTerminalApis.activateDevice.run({request: activeDeviceRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(terminalActions.setTerminal(result.data!))

                kernelTerminalCommands.setOperatingEntity(result.data!.hostEntity).executeFromParent(command)
                kernelTerminalCommands.activateDeviceSuccess().executeFromParent(command)

                return {
                    activateDevice: result.data
                }
            } else {
                throw new APIError(result)
            }
        });

    setOperatingEntity = Actor.defineCommandHandler(kernelTerminalCommands.setOperatingEntity,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'setOperatingEntity', command.payload)
            const deviceInfo = storeEntry.getStateByKey(kernelTerminalState.terminal).deviceInfo!.value
            const setOperatingEntityRequest: SetOperatingEntityRequest = {
                deviceId: deviceInfo.id,
                operatingEntityId: command.payload.id
            }
            const result = await kernelTerminalApis.setOperatingEntity.run({request: setOperatingEntityRequest})
            if (result.code === APIResponseCode.SUCCESS) {
                storeEntry.dispatchAction(terminalActions.setOperatingEntity(command.payload))
                kernelTerminalCommands.setOperatingEntitySuccess().executeFromParent(command)
                return {
                    operatingEntity: command.payload
                }
            } else {
                throw new APIError(result)
            }
        });

    deactivateDevice = Actor.defineCommandHandler(kernelTerminalCommands.deactivateDevice,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "TerminalActor"], 'deactivateDevice', command.payload)
            const deviceInfo = storeEntry.getStateByKey(kernelTerminalState.terminal).deviceInfo!.value
            const deactivateDeviceRequest: DeactivateDeviceRequest = {
                deviceId: deviceInfo.id
            }
            const result = await kernelTerminalApis.deactivateDevice.run({request: deactivateDeviceRequest})
            if (result.code === APIResponseCode.SUCCESS) {

                kernelTerminalCommands.deActivateDeviceSuccess().executeFromParent(command)

                return {
                }
            } else {
                throw new APIError(result)
            }
        });
}

