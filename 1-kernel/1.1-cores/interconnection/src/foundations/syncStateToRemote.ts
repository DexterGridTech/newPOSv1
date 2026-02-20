import {LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {DualWebSocketClient} from "./master-ws";
import {moduleName} from "../moduleName";
import {MasterServerMessageType, SyncStateWrapper} from "../types";

export const syncStateToRemote = async (key: string, stateChanged: Record<string, any>) => {
    const wsClient = DualWebSocketClient.getInstance();
    if (wsClient.isConnected()) {
        const syncState: SyncStateWrapper = {
            key: key,
            stateChanged: stateChanged,
        }
        logger.log([moduleName, LOG_TAGS.System, "syncStateToRemote"], `sync state ${key}`, syncState)
        try {
            wsClient.sendMessage(MasterServerMessageType.SYNC_STATE, syncState)
        } catch (error: any) {
            logger.error([moduleName, LOG_TAGS.System, "syncStateToRemote"], `state sync error:${error.message}`, error)
            throw error
        }
    }
}