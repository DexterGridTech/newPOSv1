import {logger, MasterWebSocketClient} from "../../core";
import {MasterServerMessageType, SyncStateWrapper} from "../../types";
import {PayloadAction} from "@reduxjs/toolkit";
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../module';

/**
 * 同步状态到从设备
 */
export const syncStateToSlave = async (key: string, stateChanged: Record<string, any>, targetDevice: string | null) => {
    const wsClient = MasterWebSocketClient.getInstance();
    if (wsClient.isConnected()) {
        const syncState: SyncStateWrapper = {
            key: key,
            stateChanged: stateChanged,
            targetDevice
        }
        logger.log([moduleName, LOG_TAGS.System, "syncStateToSlave"], "state sync--> ", syncState)
        await wsClient.sendMessage(MasterServerMessageType.SYNC_STATE, syncState, null)
            .catch(error => {
                logger.error([moduleName, LOG_TAGS.System, "syncStateToSlave"], "state sync error--> ", error)
            })
    }
}
export const updateState = (state: any, action: PayloadAction<Record<string, any>>) => {
    Object.keys(action.payload).forEach(key => {
        const newValue = action.payload[key]
        if (newValue == null) {
            delete state[key]
        } else {
            state[key] = newValue
        }
    })
}
