import {MasterWebSocketClient} from "../../foundations";
import {MasterServerMessageType, SyncStateWrapper} from "../shared";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";

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