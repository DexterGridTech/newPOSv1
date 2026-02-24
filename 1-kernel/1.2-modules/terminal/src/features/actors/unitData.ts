import {
    Actor,
    APIError,
    APIResponseCode,
    getDeviceId,
    LOG_TAGS,
    logger,
    storeEntry,
    ValueWithUpdateAt
} from "@impos2/kernel-core-base";
import {kernelTerminalCommands} from "../commands";
import {moduleName} from "../../moduleName";
import {GetUnitDataByGroupRequest} from "../../types/foundations/api";
import {kernelTerminalApis} from "../../supports";
import {UnitDataChangedSet, UnitDataState, unitDataStateKeys} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";

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
                        const value = unitDataState[k] as ValueWithUpdateAt<any>
                        return {id: k, updatedAt: value.updateAt}
                    })
                }
                console.log("======>",getUnitDataByGroupRequest)
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
}

