import { InitLogger } from "@impos2/kernel-core-base";
import { SyncType } from "../types/shared/syncType";
export const statesToSyncFromMasterToSlave = new Set();
export const statesToSyncFromSlaveToMaster = new Set();
export const setStateNeedToSync = (allModules) => {
    const initLogger = InitLogger.getInstance();
    const isolated = [];
    allModules.forEach(module => {
        Object.values(module.slices).forEach(slice => {
            if (slice.syncType === SyncType.ISOLATED) {
                isolated.push(slice.name);
            }
            else if (slice.syncType === SyncType.SLAVE_TO_MASTER) {
                statesToSyncFromSlaveToMaster.add(slice.name);
            }
            else {
                statesToSyncFromMasterToSlave.add(slice.name);
            }
        });
    });
    initLogger.logDetail('Slice Sync Type: Master → Slave', statesToSyncFromMasterToSlave.size.toString());
    initLogger.logNames([...statesToSyncFromMasterToSlave]);
    initLogger.logDetail('Slice Sync Type: Slave → Master', statesToSyncFromSlaveToMaster.size.toString());
    initLogger.logNames([...statesToSyncFromSlaveToMaster]);
    initLogger.logDetail('Slice Sync Type: Isolated', isolated.length.toString());
    initLogger.logNames(isolated);
};
