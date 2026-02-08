import {APIError, APIErrorCode, CommandHandler, currentState, dispatchAction, IActor, ICommand, logger} from "../../core";
import {
    ChangeUnitDataCommand,
    GetUnitDataCommand,
    KernelWebSocketConnectedCommand,
    UnitDataChangedCommand
} from "../commands";
import {RootState, unitDataGroups} from "../rootState";
import {GetUnitDataByGroupRequest, kernelDeviceAPI} from "../../api/device";
import {UnitDataChangedSet, UnitDataState} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../moduleName';


class UnitDataActor extends IActor {
    @CommandHandler(GetUnitDataCommand)
    private async handleGetUnitData(command: GetUnitDataCommand) {
        const rootState = currentState<RootState>()
        const group = command.payload.group as keyof RootState
        const groupState = rootState[group] as UnitDataState
        const request: GetUnitDataByGroupRequest = {
            deviceId: rootState.deviceStatus.deviceInfo?.id!,
            group: group,
            data: Object.keys(groupState).map((unitDateId) => {
                return {
                    id: unitDateId,
                    updatedAt: groupState[unitDateId].updatedAt
                }
            })
        }
        const result = await kernelDeviceAPI.getUnitDataByGroup.run({request: request})
        if (result.code === APIErrorCode.SUCCESS) {
            new ChangeUnitDataCommand({
                changeSet: result.data!
            }).executeFromParent(command)
        } else {
            throw new APIError(result)
        }
    }

    @CommandHandler(ChangeUnitDataCommand)
    private async handleChangeUnitData(command: ChangeUnitDataCommand) {
        const changeSet = command.payload.changeSet
        if ((changeSet.updated ?? []).length == 0 &&
            (changeSet.deleted ?? []).length == 0) {
            logger.log([moduleName, LOG_TAGS.Actor, "unitData"], `UDG [${changeSet.group}] has no change from kernel server`)
            return
        }
        const action: PayloadAction<UnitDataChangedSet> = {
            type: `${changeSet.group}/updateUnitData`,
            payload: changeSet
        }
        dispatchAction(action, command)
        new UnitDataChangedCommand({changeSet: changeSet}).executeFromParent(command)
    }

    @CommandHandler(KernelWebSocketConnectedCommand)
    private async handleKernelWebSocketConnected(command: KernelWebSocketConnectedCommand) {
        this.refreshUnitData(command)
    }

    private refreshUnitData = (command: ICommand<any>) => {
        Array.from(unitDataGroups).forEach(group => {
            new GetUnitDataCommand({group}).executeFromParent(command)
        })
    }
}

export const unitDataActor = new UnitDataActor()
