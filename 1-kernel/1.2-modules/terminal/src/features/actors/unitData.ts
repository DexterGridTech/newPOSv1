import {
    Actor,
    APIError,
    APIResponseCode,
    getDeviceId, kernelCoreBaseCommands, kernelCoreBaseState,
    LOG_TAGS,
    logger,
    storeEntry,
    ValueWithUpdatedAt
} from "@impos2/kernel-core-base";
import {kernelTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {GetUnitDataByGroupRequest} from "../../types/foundations/api";
import {kernelTerminalApis} from "../../supports";
import {
    kernelTerminalState,
    kernelTerminalUnitDataState,
    UnitDataChangedSet,
    UnitDataState,
    unitDataStateKeys
} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";
import {getPathValuesFromUnitData} from "../../foundations/unitData";

export class UnitDataActor extends Actor {
    kernelWSConnected = Actor.defineCommandHandler(kernelTerminalCommands.kernelWSConnected,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], 'kernelWSConnected')
            const deviceId = getDeviceId()
            for (const key of unitDataStateKeys) {
                const unitDataState = storeEntry.getStateByKey(key) as UnitDataState
                const getUnitDataByGroupRequest: GetUnitDataByGroupRequest = {
                    deviceId: deviceId,
                    group: key,
                    data: Object.keys(unitDataState).map(k => {
                        const value = unitDataState[k] as ValueWithUpdatedAt<any>
                        return {id: k, updatedAt: value.updatedAt}
                    })
                }
                const result = await kernelTerminalApis.getUnitDataByGroup.run({request: getUnitDataByGroupRequest})
                if (result.code === APIResponseCode.SUCCESS) {
                    kernelTerminalCommands.changeUnitData({changeSet:result.data!}).executeInternally()
                } else {
                    throw new APIError(result)
                }
            }
            return {};
        });
    changeUnitData = Actor.defineCommandHandler(kernelTerminalCommands.changeUnitData,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], 'changeUnitData')
            const changeSet = command.payload.changeSet
            if ((changeSet.updated ?? []).length == 0 &&
                (changeSet.deleted ?? []).length == 0) {
                logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], `Unit Data Group [${changeSet.group}] has no change from kernel server`)
                return {};
            }
            const action: PayloadAction<UnitDataChangedSet> = {
                type: `${changeSet.group}/updateUnitData`,
                payload: changeSet
            }
            storeEntry.dispatchAction(action)
            kernelTerminalCommands.unitDataChanged({changeSet: changeSet}).executeFromParent(command)
            return {};
        });
    unitDataChanged = Actor.defineCommandHandler(kernelTerminalCommands.unitDataChanged,
        async (command): Promise<Record<string, any>> => {
            if(command.payload.changeSet.group===kernelTerminalUnitDataState.errorMessages){
                const errorMessagesState = storeEntry.getStateByKey(kernelTerminalUnitDataState.errorMessages)
                const terminalState=storeEntry.getStateByKey(kernelTerminalState.terminal)
                const operatingEntity=terminalState.operatingEntity?.value!
                const model=terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, errorMessagesState
                )
                kernelCoreBaseCommands.updateErrorMessages(pathValues).executeInternally()
            }
            if(command.payload.changeSet.group===kernelTerminalUnitDataState.systemParameters){
                const systemParametersState = storeEntry.getStateByKey(kernelTerminalUnitDataState.systemParameters)
                const terminalState=storeEntry.getStateByKey(kernelTerminalState.terminal)
                const operatingEntity=terminalState.operatingEntity?.value!
                const model=terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, systemParametersState
                )
                kernelCoreBaseCommands.updateSystemParameters(pathValues).executeInternally()
            }
            return {};
        });
}

