import {
    Actor,
    APIError,
    APIResponseCode,
    getDeviceId,
    kernelCoreBaseCommands,
    LOG_TAGS,
    logger, RootState,
    storeEntry,
    ValueWithUpdatedAt
} from "@impos2/kernel-core-base";
import {kernelCoreTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {GetUnitDataByGroupRequest} from "../../types/foundations/api";
import {kernelCoreTerminalApis} from "../../supports";
import {
    kernelCoreTerminalState,
    kernelCoreTerminalUnitDataState,
    UnitDataChangedSet,
    UnitDataState,
    unitDataStateKeys
} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";
import {getPathValuesFromUnitData} from "../../foundations/unitData";
import {kernelCoreTaskCommands} from "@impos2/kernel-core-task";

export class UnitDataActor extends Actor {
    kernelWSConnected = Actor.defineCommandHandler(kernelCoreTerminalCommands.kernelWSConnected,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], 'kernelWSConnected')
            const deviceId = getDeviceId()
            for (const key of unitDataStateKeys) {
                const unitDataState = storeEntry.getStateByKey(key) as UnitDataState
                const getUnitDataByGroupRequest: GetUnitDataByGroupRequest = {
                    deviceId: deviceId,
                    group: key,
                    data: Object.keys(unitDataState).filter(k => k !== '_persist').map(k => {
                        const value = unitDataState[k] as ValueWithUpdatedAt<any>
                        return {id: k, updatedAt: value.updatedAt}
                    })
                }
                const result = await kernelCoreTerminalApis.getUnitDataByGroup.run({request: getUnitDataByGroupRequest})
                if (result.code === APIResponseCode.SUCCESS) {
                    kernelCoreTerminalCommands.changeUnitData({changeSet: result.data!}).executeInternally()
                } else {
                    throw new APIError(result)
                }
            }
            return {};
        });
    changeUnitData = Actor.defineCommandHandler(kernelCoreTerminalCommands.changeUnitData,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], 'changeUnitData')
            const changeSet = command.payload.changeSet
            if ((changeSet.updated ?? []).length == 0 &&
                (changeSet.deleted ?? []).length == 0) {
                logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], `Unit Data Group [${changeSet.group}] has no change from kernel server`)
                return {};
            }
            // 检查changeSet.group，如果不是RootState的key则返回
            if (!(changeSet.group in storeEntry.getState())){
                logger.error([moduleName, LOG_TAGS.Actor, "UnitDataActor"], `Unit Data Group [${changeSet.group}] is not valid`)
                return {};
            }
            const action: PayloadAction<UnitDataChangedSet> = {
                type: `${changeSet.group}/updateUnitData`,
                payload: changeSet
            }
            storeEntry.dispatchAction(action)
            kernelCoreTerminalCommands.unitDataChanged({changeSet: changeSet}).executeFromParent(command)
            return {};
        });
    unitDataChanged = Actor.defineCommandHandler(kernelCoreTerminalCommands.unitDataChanged,
        async (command): Promise<Record<string, any>> => {
            if (command.payload.changeSet.group === kernelCoreTerminalUnitDataState.unitData_errorMessages) {
                const unitData_errorMessagesState = storeEntry.getStateByKey(kernelCoreTerminalUnitDataState.unitData_errorMessages)
                const terminalState = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
                const operatingEntity = terminalState.operatingEntity?.value!
                const model = terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, unitData_errorMessagesState
                )
                kernelCoreBaseCommands.updateErrorMessages(pathValues).executeInternally()
            }
            if (command.payload.changeSet.group === kernelCoreTerminalUnitDataState.unitData_systemParameters) {
                const unitData_systemParametersState = storeEntry.getStateByKey(kernelCoreTerminalUnitDataState.unitData_systemParameters)
                const terminalState = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
                const operatingEntity = terminalState.operatingEntity?.value!
                const model = terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, unitData_systemParametersState
                )
                kernelCoreBaseCommands.updateSystemParameters(pathValues).executeInternally()
            }
            if (command.payload.changeSet.group === kernelCoreTerminalUnitDataState.unitData_taskDefinitions) {
                const unitData_taskDefinitionsState = storeEntry.getStateByKey(kernelCoreTerminalUnitDataState.unitData_taskDefinitions)
                const terminalState = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
                const operatingEntity = terminalState.operatingEntity?.value!
                const model = terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, unitData_taskDefinitionsState
                )
                kernelCoreTaskCommands.updateTaskDefinitions(pathValues).executeInternally()
            }
            return {};
        });
}

